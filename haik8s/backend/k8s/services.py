"""
Kubernetes Service management for HAI-K8S
"""
from typing import Optional
from kubernetes import client
from kubernetes.client.rest import ApiException
from k8s.client import get_core_v1


def create_ssh_service(namespace: str, pod_name: str, node_port: int) -> client.V1Service:
    """Create a NodePort service mapping port 22 for SSH access"""
    v1 = get_core_v1()

    service_name = f"{pod_name}-ssh"

    service = client.V1Service(
        metadata=client.V1ObjectMeta(
            name=service_name,
            namespace=namespace,
            labels={"app": "haik8s", "container": pod_name},
        ),
        spec=client.V1ServiceSpec(
            type="NodePort",
            selector={"app": "haik8s", "container": pod_name},
            ports=[
                client.V1ServicePort(
                    port=22,
                    target_port=22,
                    node_port=node_port,
                    protocol="TCP",
                    name="ssh",
                )
            ],
        ),
    )

    return v1.create_namespaced_service(namespace=namespace, body=service)


def delete_service(namespace: str, service_name: str):
    """Delete a service"""
    v1 = get_core_v1()
    try:
        v1.delete_namespaced_service(name=service_name, namespace=namespace)
    except ApiException as e:
        if e.status != 404:
            raise


def get_used_nodeports() -> set[int]:
    """Return the set of NodePorts currently allocated across the entire cluster."""
    v1 = get_core_v1()
    used = set()
    try:
        services = v1.list_service_for_all_namespaces()
        for svc in services.items:
            if svc.spec and svc.spec.ports:
                for port in svc.spec.ports:
                    if port.node_port:
                        used.add(port.node_port)
    except ApiException:
        pass
    return used


def get_service(namespace: str, service_name: str) -> Optional[client.V1Service]:
    """Get a service"""
    v1 = get_core_v1()
    try:
        return v1.read_namespaced_service(name=service_name, namespace=namespace)
    except ApiException as e:
        if e.status == 404:
            return None
        raise
