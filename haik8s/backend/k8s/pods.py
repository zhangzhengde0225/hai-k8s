"""
Kubernetes Pod management for HAI-K8S
"""
from typing import Optional
from kubernetes import client
from kubernetes.client.rest import ApiException
from k8s.client import get_core_v1


def create_pod(
    namespace: str,
    name: str,
    image: str,
    cpu: float,
    memory: float,
    gpu: int = 0,
    ssh_enabled: bool = False,
    command: Optional[list[str]] = None,
) -> client.V1Pod:
    """Create a pod with resource limits and optional GPU/SSH"""
    v1 = get_core_v1()

    resources = {
        "requests": {
            "cpu": str(cpu),
            "memory": f"{int(memory * 1024)}Mi",
        },
        "limits": {
            "cpu": str(cpu),
            "memory": f"{int(memory * 1024)}Mi",
        },
    }
    if gpu > 0:
        resources["limits"]["nvidia.com/gpu"] = str(gpu)
        resources["requests"]["nvidia.com/gpu"] = str(gpu)

    ports = []
    if ssh_enabled:
        ports.append(client.V1ContainerPort(container_port=22, name="ssh"))

    container = client.V1Container(
        name="main",
        image=image,
        resources=client.V1ResourceRequirements(**resources),
        ports=ports or None,
        command=command,
        stdin=True,
        tty=True,
    )

    pod = client.V1Pod(
        metadata=client.V1ObjectMeta(
            name=name,
            namespace=namespace,
            labels={
                "app": "haik8s",
                "container": name,
            },
        ),
        spec=client.V1PodSpec(
            containers=[container],
            restart_policy="Never",
        ),
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
        raise


def list_namespace_pods(namespace: str) -> list[client.V1Pod]:
    """List all pods in a namespace"""
    v1 = get_core_v1()
    try:
        result = v1.list_namespaced_pod(namespace=namespace, label_selector="app=haik8s")
        return result.items
    except ApiException as e:
        if e.status == 404:
            return []
        raise
