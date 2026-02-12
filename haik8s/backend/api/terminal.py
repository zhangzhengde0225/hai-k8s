"""
WebSocket terminal endpoint
"""
import asyncio
import json
import threading
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError
from sqlmodel import Session

from db.database import get_session, engine
from db.crud import get_container_by_id, get_user_by_id
from db.models import ContainerStatus
from auth.security import decode_access_token
from k8s.terminal import exec_into_pod


router = APIRouter(tags=["Terminal"])
logger = logging.getLogger(__name__)


@router.websocket("/api/containers/{container_id}/terminal")
async def websocket_terminal(
    websocket: WebSocket,
    container_id: int,
    token: str = Query(...),
):
    """
    WebSocket terminal bridge to K8s pod exec.

    Authenticate via query param token, then bridge:
    - Background thread: K8s stdout -> asyncio Queue -> WebSocket
    - WebSocket input -> K8s stdin
    """
    logger.info(f"WebSocket connection attempt for container {container_id}")

    # Accept connection first (required for WebSocket protocol)
    await websocket.accept()
    logger.info(f"WebSocket accepted for container {container_id}")

    # Authenticate
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
        logger.info(f"Authentication successful for user {user_id}")
    except (JWTError, TypeError, ValueError) as e:
        logger.warning(f"Authentication failed for container {container_id}: {e}")
        await websocket.send_text("\r\nAuthentication failed: Invalid token\r\n")
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Validate container access - ensure engine is available
    if engine is None:
        logger.error("Database engine not initialized")
        await websocket.send_text("\r\nDatabase not initialized\r\n")
        await websocket.close(code=1011, reason="Database not initialized")
        return

    with Session(bind=engine) as session:
        user = get_user_by_id(session, user_id)
        if not user or not user.is_active:
            logger.warning(f"Invalid or inactive user {user_id}")
            await websocket.send_text("\r\nAuthentication failed: Invalid user\r\n")
            await websocket.close(code=4001, reason="Invalid user")
            return

        container = get_container_by_id(session, container_id)
        if not container or container.user_id != user.id:
            logger.warning(f"Container {container_id} not found or access denied for user {user_id}")
            await websocket.send_text("\r\nContainer not found or access denied\r\n")
            await websocket.close(code=4004, reason="Container not found")
            return

        # Compare status - handle both enum and string
        container_status = container.status.value if isinstance(container.status, ContainerStatus) else container.status
        logger.info(f"Container {container_id} status: {container_status}")

        if container_status != ContainerStatus.RUNNING.value:
            logger.warning(f"Container {container_id} is not running (status: {container_status})")
            await websocket.send_text(f"\r\nContainer is not running (status: {container_status})\r\n")
            await websocket.close(code=1008, reason="Container is not running")
            return

        namespace = container.k8s_namespace
        pod_name = container.k8s_pod_name
        logger.info(f"Connecting to pod {pod_name} in namespace {namespace}")

    # Open K8s exec stream
    try:
        k8s_stream = exec_into_pod(namespace, pod_name)
        logger.info(f"K8s exec stream opened for pod {pod_name}")
    except Exception as e:
        logger.error(f"Failed to connect to pod {pod_name}: {e}")
        await websocket.send_text(f"\r\nFailed to connect to container: {str(e)}\r\n")
        await websocket.close()
        return

    output_queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    stop_event = threading.Event()

    # Background thread: read K8s stdout -> queue
    def read_k8s_output():
        try:
            while not stop_event.is_set() and k8s_stream.is_open():
                k8s_stream.update(timeout=1)
                if k8s_stream.peek_stdout():
                    data = k8s_stream.read_stdout()
                    loop.call_soon_threadsafe(output_queue.put_nowait, data)
                if k8s_stream.peek_stderr():
                    data = k8s_stream.read_stderr()
                    loop.call_soon_threadsafe(output_queue.put_nowait, data)
        except Exception:
            pass
        finally:
            loop.call_soon_threadsafe(output_queue.put_nowait, None)

    reader_thread = threading.Thread(target=read_k8s_output, daemon=True)
    reader_thread.start()

    # Forward output from queue to WebSocket
    async def forward_output():
        try:
            while True:
                data = await output_queue.get()
                if data is None:
                    break
                await websocket.send_text(data)
        except (WebSocketDisconnect, Exception):
            pass

    output_task = asyncio.create_task(forward_output())

    # Read WebSocket input -> K8s stdin
    try:
        while True:
            message = await websocket.receive_text()
            # Handle resize messages
            try:
                msg = json.loads(message)
                if msg.get("type") == "resize":
                    rows = msg.get("rows", 24)
                    cols = msg.get("cols", 80)
                    # K8s stream resize channel
                    k8s_stream.write_channel(4, json.dumps({"Height": rows, "Width": cols}))
                    continue
            except (json.JSONDecodeError, ValueError):
                pass
            # Regular input
            if k8s_stream.is_open():
                k8s_stream.write_stdin(message)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        stop_event.set()
        output_task.cancel()
        try:
            k8s_stream.close()
        except Exception:
            pass
