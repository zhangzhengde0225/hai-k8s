"""
Kubernetes exec/terminal streaming for HAI-K8S
"""
from kubernetes import client
from kubernetes.stream import stream
from k8s.client import get_core_v1


def exec_into_pod(namespace: str, pod_name: str, command: list[str] = None):
    """
    Open an interactive exec stream into a pod.

    Returns the websocket stream object that supports read/write.
    The caller is responsible for managing the stream lifecycle.
    """
    v1 = get_core_v1()
    if command is None:
        command = ["/bin/bash"]

    resp = stream(
        v1.connect_get_namespaced_pod_exec,
        pod_name,
        namespace,
        command=command,
        stderr=True,
        stdin=True,
        stdout=True,
        tty=True,
        _preload_content=False,
    )
    return resp
