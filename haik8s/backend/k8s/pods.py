"""
Kubernetes pod management
"""
from typing import Optional
from kubernetes import client
from kubernetes.client.rest import ApiException
from .client import get_core_v1


def create_pod(
    namespace: str,
    name: str,
    image: str,
    cpu: float,
    memory: float,
    gpu: int,
    ssh_enabled: bool = False,
) -> client.V1Pod:
    """Create a pod with resource requests"""
    v1 = get_core_v1()

    # Build resource requests
    resources = client.V1ResourceRequirements(
        requests={
            "cpu": str(cpu),
            "memory": f"{int(memory)}Gi",
        },
        limits={
            "cpu": str(cpu),
            "memory": f"{int(memory)}Gi",
        },
    )

    if gpu > 0:
        resources.requests["nvidia.com/gpu"] = str(gpu)
        resources.limits["nvidia.com/gpu"] = str(gpu)

    # Container spec
    container = client.V1Container(
        name="main",
        image=image,
        command=["/bin/bash", "-c", "tail -f /dev/null"] if not ssh_enabled else None,
        resources=resources,
        security_context=client.V1SecurityContext(privileged=True) if ssh_enabled else None,
    )

    # Pod spec
    pod_spec = client.V1PodSpec(
        containers=[container],
        restart_policy="Always",
    )

    # Pod metadata
    pod_metadata = client.V1ObjectMeta(
        name=name,
        labels={"app": name, "managed-by": "haik8s"},
    )

    pod = client.V1Pod(
        api_version="v1",
        kind="Pod",
        metadata=pod_metadata,
        spec=pod_spec,
    )

    return v1.create_namespaced_pod(namespace=namespace, body=pod)


def delete_pod(namespace: str, name: str):
    """Delete a pod"""
    v1 = get_core_v1()
    try:
        v1.delete_namespaced_pod(name=name, namespace=namespace)
    except ApiException as e:
        if e.status != 404:
            raise


def get_pod_status(namespace: str, name: str) -> Optional[str]:
    """Get pod phase (Pending/Running/Succeeded/Failed/Unknown)"""
    v1 = get_core_v1()
    try:
        pod = v1.read_namespaced_pod(name=name, namespace=namespace)
        return pod.status.phase
    except ApiException as e:
        if e.status == 404:
            return None
        raise


def get_pod_events(namespace: str, pod_name: str) -> list[dict]:
    """
    Get events for a specific pod.
    Returns a list of event dictionaries with type, reason, message, and timestamp.
    """
    v1 = get_core_v1()
    try:
        # Get the pod first to get its UID
        pod = v1.read_namespaced_pod(name=pod_name, namespace=namespace)
        pod_uid = pod.metadata.uid

        # Get all events in the namespace
        events = v1.list_namespaced_event(namespace=namespace)

        # Filter events related to this pod
        pod_events = []
        for event in events.items:
            if (event.involved_object.kind == "Pod" and
                event.involved_object.name == pod_name and
                event.involved_object.uid == pod_uid):

                pod_events.append({
                    "type": event.type,  # Normal or Warning
                    "reason": event.reason,  # Pulling, Pulled, Created, Started, etc.
                    "message": event.message,
                    "count": event.count,
                    "first_timestamp": event.first_timestamp.isoformat() if event.first_timestamp else None,
                    "last_timestamp": event.last_timestamp.isoformat() if event.last_timestamp else None,
                })

        # Sort by last timestamp (most recent first)
        pod_events.sort(key=lambda x: x["last_timestamp"] or x["first_timestamp"] or "", reverse=True)

        return pod_events

    except ApiException as e:
        if e.status == 404:
            return []
        raise


def get_pod_details(namespace: str, name: str) -> Optional[dict]:
    """
    Get detailed pod information including status, conditions, and container states.
    """
    v1 = get_core_v1()
    try:
        pod = v1.read_namespaced_pod(name=name, namespace=namespace)

        details = {
            "phase": pod.status.phase,
            "conditions": [],
            "container_statuses": [],
        }

        # Parse conditions
        if pod.status.conditions:
            for cond in pod.status.conditions:
                details["conditions"].append({
                    "type": cond.type,
                    "status": cond.status,
                    "reason": cond.reason,
                    "message": cond.message,
                })

        # Parse container statuses
        if pod.status.container_statuses:
            for cs in pod.status.container_statuses:
                container_info = {
                    "name": cs.name,
                    "ready": cs.ready,
                    "restart_count": cs.restart_count,
                    "state": {},
                }

                # Current state
                if cs.state.waiting:
                    container_info["state"] = {
                        "status": "waiting",
                        "reason": cs.state.waiting.reason,
                        "message": cs.state.waiting.message,
                    }
                elif cs.state.running:
                    container_info["state"] = {
                        "status": "running",
                        "started_at": cs.state.running.started_at.isoformat() if cs.state.running.started_at else None,
                    }
                elif cs.state.terminated:
                    container_info["state"] = {
                        "status": "terminated",
                        "reason": cs.state.terminated.reason,
                        "message": cs.state.terminated.message,
                        "exit_code": cs.state.terminated.exit_code,
                    }

                details["container_statuses"].append(container_info)

        return details

    except ApiException as e:
        if e.status == 404:
            return None
        raise


def get_pod_logs(namespace: str, name: str, tail_lines: int = 200) -> str:
    """Get pod logs"""
    v1 = get_core_v1()
    try:
        return v1.read_namespaced_pod_log(
            name=name,
            namespace=namespace,
            tail_lines=tail_lines,
        )
    except ApiException as e:
        if e.status == 404:
            return "Pod not found"
        if e.status == 400:
            return "Container not started yet"
        return f"Error fetching logs: {e}"
