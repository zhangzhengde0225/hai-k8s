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


def get_pod_logs(namespace: str, name: str, container: Optional[str] = None, tail_lines: int = 200) -> str:
    """Get pod logs, supports specifying container for multi-container pods"""
    v1 = get_core_v1()
    try:
        return v1.read_namespaced_pod_log(
            name=name,
            namespace=namespace,
            container=container,  # If None, K8s will automatically select the first container
            tail_lines=tail_lines,
        )
    except ApiException as e:
        if e.status == 404:
            return "Pod not found"
        if e.status == 400:
            return "Container not started yet"
        return f"Error fetching logs: {e}"


def list_all_pods_in_cluster() -> list[dict]:
    """
    List all PODs in all namespaces across the K8s cluster.

    Returns a list of POD dictionaries containing:
    - namespace: Namespace
    - name: POD name
    - phase: Status (Running/Pending/Failed etc.)
    - pod_ip: POD IP address
    - node_name: Running node
    - created_at: Creation time
    - containers: Container list (name, image, ready status, restart count)
    - labels: Label dictionary (used to identify system-managed PODs)
    - resource_requests: Resource requests (CPU/memory/GPU)
    - resource_limits: Resource limits
    - owner_references: Parent resource references (Deployment/StatefulSet etc.)
    """
    v1 = get_core_v1()
    pods = v1.list_pod_for_all_namespaces()

    result = []
    for pod in pods.items:
        # Parse container info
        containers = []
        if pod.spec.containers:
            for c in pod.spec.containers:
                restart_count = 0
                ready = False
                if pod.status.container_statuses:
                    for cs in pod.status.container_statuses:
                        if cs.name == c.name:
                            restart_count = cs.restart_count
                            ready = cs.ready
                            break

                containers.append({
                    "name": c.name,
                    "image": c.image,
                    "ready": ready,
                    "restart_count": restart_count,
                })

        # Parse resource requests and limits
        resources_req = {}
        resources_lim = {}
        if pod.spec.containers:
            for c in pod.spec.containers:
                if c.resources:
                    if c.resources.requests:
                        resources_req = {
                            "cpu": c.resources.requests.get("cpu"),
                            "memory": c.resources.requests.get("memory"),
                            "gpu": c.resources.requests.get("nvidia.com/gpu"),
                        }
                    if c.resources.limits:
                        resources_lim = {
                            "cpu": c.resources.limits.get("cpu"),
                            "memory": c.resources.limits.get("memory"),
                            "gpu": c.resources.limits.get("nvidia.com/gpu"),
                        }

        # Check if this is a system-managed POD
        labels = pod.metadata.labels or {}
        is_system_managed = labels.get("managed-by") == "haik8s"

        # Parse owner references
        owner_refs = []
        if pod.metadata.owner_references:
            for owner in pod.metadata.owner_references:
                owner_refs.append({
                    "kind": owner.kind,
                    "name": owner.name,
                })

        result.append({
            "namespace": pod.metadata.namespace,
            "name": pod.metadata.name,
            "phase": pod.status.phase,
            "pod_ip": pod.status.pod_ip,
            "node_name": pod.spec.node_name,
            "host_ip": pod.status.host_ip,
            "created_at": pod.metadata.creation_timestamp,
            "containers": containers,
            "labels": dict(labels),
            "is_system_managed": is_system_managed,
            "resource_requests": resources_req,
            "resource_limits": resources_lim,
            "owner_references": owner_refs,
        })

    return result


def get_pod_describe(namespace: str, name: str) -> dict:
    """
    Get detailed POD description info (similar to kubectl describe pod).

    Returns complete POD object information including:
    - metadata: Metadata (labels, annotations etc.)
    - spec: Specification configuration
    - status: Current status
    - conditions: Status condition list
    - volumes: Volume configuration
    """
    v1 = get_core_v1()
    pod = v1.read_namespaced_pod(name=name, namespace=namespace)

    # Parse conditions
    conditions = []
    if pod.status.conditions:
        for cond in pod.status.conditions:
            conditions.append({
                "type": cond.type,
                "status": cond.status,
                "reason": cond.reason,
                "message": cond.message,
                "last_transition_time": cond.last_transition_time.isoformat() if cond.last_transition_time else None,
            })

    # Parse volumes
    volumes = []
    if pod.spec.volumes:
        for vol in pod.spec.volumes:
            vol_dict = {"name": vol.name}
            # Identify volume type
            if vol.config_map:
                vol_dict["type"] = "ConfigMap"
                vol_dict["source"] = vol.config_map.name
            elif vol.secret:
                vol_dict["type"] = "Secret"
                vol_dict["source"] = vol.secret.secret_name
            elif vol.empty_dir:
                vol_dict["type"] = "EmptyDir"
            elif vol.host_path:
                vol_dict["type"] = "HostPath"
                vol_dict["source"] = vol.host_path.path
            elif vol.persistent_volume_claim:
                vol_dict["type"] = "PersistentVolumeClaim"
                vol_dict["source"] = vol.persistent_volume_claim.claim_name
            else:
                vol_dict["type"] = "Other"

            volumes.append(vol_dict)

    # Convert K8s object to dictionary (for JSON serialization)
    return {
        "namespace": pod.metadata.namespace,
        "name": pod.metadata.name,
        "labels": dict(pod.metadata.labels or {}),
        "annotations": dict(pod.metadata.annotations or {}),
        "phase": pod.status.phase,
        "pod_ip": pod.status.pod_ip,
        "host_ip": pod.status.host_ip,
        "node_name": pod.spec.node_name,
        "created_at": pod.metadata.creation_timestamp.isoformat() if pod.metadata.creation_timestamp else None,
        "conditions": conditions,
        "volumes": volumes,
        "restart_policy": pod.spec.restart_policy,
        "service_account": pod.spec.service_account_name,
    }
