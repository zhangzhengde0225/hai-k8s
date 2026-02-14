#!/usr/bin/env python3
"""
SSH LoadBalancer Service Creator for Kubernetes Pods

This module provides functions to create LoadBalancer-type services for SSH access
using MetalLB for automatic IP allocation.

Author: Zhengde ZHANG
"""

import time
from typing import Optional
from kubernetes import client
from kubernetes.client.rest import ApiException


def create_ssh_loadbalancer_service(
    namespace: str,
    pod_name: str,
    service_name: Optional[str] = None,
    ssh_port: int = 22,
) -> client.V1Service:
    """
    Create a LoadBalancer-type SSH Service using MetalLB for automatic IP allocation.

    Args:
        namespace: K8s namespace
        pod_name: Pod name, used for selector
        service_name: Service name (defaults to {pod_name}-ssh-lb)
        ssh_port: SSH port (default 22)

    Returns:
        Created Service object

    Raises:
        ApiException: If service creation fails
    """
    from k8s.client import get_core_v1

    if service_name is None:
        service_name = f"{pod_name}-ssh-lb"

    v1 = get_core_v1()

    # Service spec
    service_spec = client.V1ServiceSpec(
        type="LoadBalancer",
        selector={
            "app": pod_name,
            "managed-by": "haik8s"
        },
        ports=[
            client.V1ServicePort(
                protocol="TCP",
                port=ssh_port,
                target_port=ssh_port,
            )
        ],
    )

    # Service metadata
    service_metadata = client.V1ObjectMeta(
        name=service_name,
        labels={
            "app": pod_name,
            "managed-by": "haik8s",
            "service-type": "ssh-loadbalancer"
        },
    )

    # Create service
    service = client.V1Service(
        api_version="v1",
        kind="Service",
        metadata=service_metadata,
        spec=service_spec,
    )

    return v1.create_namespaced_service(namespace=namespace, body=service)


def get_loadbalancer_ip(
    namespace: str,
    service_name: str,
    timeout: int = 60,
) -> Optional[str]:
    """
    Wait for and retrieve the LoadBalancer's assigned external IP.

    Args:
        namespace: K8s namespace
        service_name: Service name
        timeout: Timeout in seconds (default 60)

    Returns:
        Assigned external IP address, or None if timeout occurs
    """
    from k8s.client import get_core_v1

    v1 = get_core_v1()
    start_time = time.time()

    while time.time() - start_time < timeout:
        try:
            service = v1.read_namespaced_service(name=service_name, namespace=namespace)

            # Check if LoadBalancer IP is assigned
            if service.status and service.status.load_balancer:
                ingress = service.status.load_balancer.ingress
                if ingress and len(ingress) > 0:
                    # Get IP from first ingress entry
                    lb_ip = ingress[0].ip
                    if lb_ip:
                        return lb_ip

            # Wait before next check
            time.sleep(2)

        except ApiException as e:
            print(f"   ⚠️  Warning: Error checking service status: {e}")
            time.sleep(2)

    return None


def delete_ssh_loadbalancer_service(
    namespace: str,
    service_name: str,
) -> bool:
    """
    Delete a LoadBalancer service.

    Args:
        namespace: K8s namespace
        service_name: Service name

    Returns:
        True if deletion succeeded, False otherwise
    """
    from k8s.client import get_core_v1

    v1 = get_core_v1()

    try:
        v1.delete_namespaced_service(name=service_name, namespace=namespace)
        return True
    except ApiException as e:
        print(f"   ⚠️  Warning: Could not delete service {service_name}: {e}")
        return False


if __name__ == "__main__":
    """
    Example usage and testing
    """
    print("=" * 80)
    print("SSH LoadBalancer Service Creator - Example")
    print("=" * 80)
    print()

    # This is just an example - in real usage, these functions are called from
    # launch_openclaw.py after the pod is created

    print("Example: Creating LoadBalancer service for SSH access")
    print("-" * 80)
    print()
    print("# After creating a pod named 'user-container':")
    print("service = create_ssh_loadbalancer_service(")
    print("    namespace='haik8s-user',")
    print("    pod_name='user-container',")
    print("    service_name='user-container-ssh-lb',")
    print(")")
    print()
    print("# Wait for LoadBalancer IP allocation:")
    print("lb_ip = get_loadbalancer_ip(")
    print("    namespace='haik8s-user',")
    print("    service_name='user-container-ssh-lb',")
    print("    timeout=60")
    print(")")
    print()
    print("if lb_ip:")
    print("    print(f'SSH access: ssh user@{lb_ip}')")
    print()
