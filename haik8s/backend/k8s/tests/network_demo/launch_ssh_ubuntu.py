#!/usr/bin/env python3
"""
Launch SSH Ubuntu K8s Pod with Network Mounts - Simplified Demo

This script creates a minimal K8s pod focused on demonstrating network volume mounts.
Other features are simplified or omitted.

Author: Based on launch_openclaw.py
"""
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import hepai as hai
from kubernetes import client
from config import Config
from k8s.client import init_k8s_client, get_core_v1, ensure_namespace
from dataclasses import dataclass, field


def create_pod_with_network_mount(
    namespace: str,
    name: str,
    image: str = "ubuntu:22.04",
    volume_mounts: list = None,
) -> client.V1Pod:
    """
    Create a simple pod with network volume mounts.

    Args:
        namespace: K8s namespace
        name: Pod name
        image: Container image (default: ubuntu:22.04)
        volume_mounts: List of volume mounts, each dict with 'host_path' and 'mount_path'
                       Example: [
                           {"host_path": "/aifs/user/home/zdzhang", "mount_path": "/home/zdzhang"},
                           {"host_path": "/aifs/data", "mount_path": "/data"}
                       ]
    """
    v1 = get_core_v1()

    # Simple resource requests
    resources = client.V1ResourceRequirements(
        requests={
            "cpu": "0.5",
            "memory": "512Mi",
        },
        limits={
            "cpu": "1",
            "memory": "1Gi",
        },
    )

    # Build volume mounts for container
    container_volume_mounts = []
    volumes = []

    if volume_mounts:
        for idx, mount in enumerate(volume_mounts):
            volume_name = f"volume-{idx}"
            host_path = mount.get("host_path")
            mount_path = mount.get("mount_path")

            if host_path and mount_path:
                # Add volume mount to container
                container_volume_mounts.append(
                    client.V1VolumeMount(
                        name=volume_name,
                        mount_path=mount_path,
                    )
                )

                # Add volume to pod spec
                volumes.append(
                    client.V1Volume(
                        name=volume_name,
                        host_path=client.V1HostPathVolumeSource(
                            path=host_path,
                            type="Directory"  # Ensure host path exists
                        ),
                    )
                )

    # Simple container with SSH enabled
    container = client.V1Container(
        name="main",
        image=image,
        command=["/bin/bash", "-c", """
# Install SSH server and nginx
apt-get update && apt-get install -y openssh-server nginx

# Setup SSH
mkdir -p /run/sshd
echo 'root:test123' | chpasswd
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# Start SSH service in background
/usr/sbin/sshd

# Start nginx in foreground
nginx -g 'daemon off;'
"""],
        resources=resources,
        volume_mounts=container_volume_mounts if container_volume_mounts else None,
        security_context=client.V1SecurityContext(
            privileged=True,
            run_as_user=0,
        ),
    )

    # Pod spec
    pod_spec = client.V1PodSpec(
        containers=[container],
        volumes=volumes if volumes else None,
        restart_policy="Always",
    )

    # Pod metadata
    pod_metadata = client.V1ObjectMeta(
        name=name,
        labels={"app": name, "demo": "network-mount"},
    )

    pod = client.V1Pod(
        api_version="v1",
        kind="Pod",
        metadata=pod_metadata,
        spec=pod_spec,
    )

    return v1.create_namespaced_pod(namespace=namespace, body=pod)


def create_loadbalancer_service(
    namespace: str,
    pod_name: str,
    service_name: str,
    ports: list = None,
    load_balancer_ip: str = None,
) -> client.V1Service:
    """
    Create a LoadBalancer service for SSH access.

    Args:
        namespace: K8s namespace
        pod_name: Pod name for selector
        service_name: Service name
        ports: List of port dicts, e.g., [{"name": "ssh", "port": 22}, {"name": "http", "port": 80}]
               Default: [{"name": "ssh", "port": 22}]
        load_balancer_ip: Specify LoadBalancer IP address (optional)
                          Must be in MetalLB IP pool range
    """
    v1 = get_core_v1()

    # Default to SSH port if no ports specified
    if not ports:
        ports = [{"name": "ssh", "port": 22}]

    # Build port list
    service_ports = []
    for port_config in ports:
        port_name = port_config.get("name", "port")
        port_number = port_config.get("port")
        target_port = port_config.get("target_port", port_number)

        service_ports.append(
            client.V1ServicePort(
                name=port_name,
                port=port_number,
                target_port=target_port,
                protocol="TCP",
            )
        )

    service_spec = client.V1ServiceSpec(
        type="LoadBalancer",
        selector={"app": pod_name},
        ports=service_ports,
    )

    # Set specific LoadBalancer IP if provided
    if load_balancer_ip:
        service_spec.load_balancer_ip = load_balancer_ip

    service = client.V1Service(
        api_version="v1",
        kind="Service",
        metadata=client.V1ObjectMeta(
            name=service_name,
            labels={"app": pod_name},
        ),
        spec=service_spec,
    )

    return v1.create_namespaced_service(namespace=namespace, body=service)


def launch_ssh_ubuntu(
    namespace: str = "demo",
    pod_name: str = "ssh-ubuntu-demo",
    service_name: str = "ssh-ubuntu-svc",
    image: str = "ubuntu:22.04",
    volume_mounts: list = None,
    load_balancer_ip: str = None,
):
    """
    Launch a simple SSH Ubuntu pod with network mounts.

    Args:
        namespace: K8s namespace
        pod_name: Pod name
        service_name: Service name
        image: Container image
        volume_mounts: List of volume mounts [{"host_path": "/path", "mount_path": "/path"}]
        load_balancer_ip: Specify LoadBalancer IP address (optional, must be in MetalLB pool)
    """
    print(f"🚀 Launching SSH Ubuntu pod with network mounts")
    print(f"   Namespace: {namespace}")
    print(f"   Pod name: {pod_name}")
    print(f"   Service name: {service_name}")
    print(f"   Image: {image}")
    if load_balancer_ip:
        print(f"   LoadBalancer IP: {load_balancer_ip}")
    if volume_mounts:
        print(f"   Volume mounts:")
        for mount in volume_mounts:
            print(f"     - {mount.get('host_path')} -> {mount.get('mount_path')}")
    print()

    # Initialize K8s client
    print("☸️  Initializing Kubernetes client...")
    init_k8s_client(Config.KUBECONFIG_PATH)
    print()

    try:
        # Ensure namespace exists
        print(f"   Creating/verifying namespace: {namespace}")
        ensure_namespace(namespace)

        # Create pod
        print(f"   Creating pod: {pod_name}")
        create_pod_with_network_mount(
            namespace=namespace,
            name=pod_name,
            image=image,
            volume_mounts=volume_mounts,
        )
        print(f"   ✅ Pod created successfully")

        # Create LoadBalancer service for SSH
        print(f"   Creating SSH LoadBalancer service: {service_name}")

        # Define ports to expose (SSH + HTTP)
        service_ports = [
            {"name": "ssh", "port": 22},
            {"name": "http", "port": 80},
        ]

        create_loadbalancer_service(
            namespace=namespace,
            pod_name=pod_name,
            service_name=service_name,
            ports=service_ports,
            load_balancer_ip=load_balancer_ip,
        )
        print(f"   ✅ SSH LoadBalancer service created")

        print()
        print("🎉 SSH Ubuntu pod launched successfully!")
        print()
        print("📋 Service Details:")
        print(f"   Namespace: {namespace}")
        print(f"   Pod Name: {pod_name}")
        print(f"   Service Name: {service_name}")
        print(f"   SSH User: root")
        print(f"   SSH Password: test123")
        print()
        print("💡 Next Steps:")
        print(f"   1. Wait for LoadBalancer IP: kubectl get svc -n {namespace} {service_name}")
        print(f"   2. Check pod status: kubectl get pods -n {namespace}")
        print(f"   3. View pod logs: kubectl logs -n {namespace} {pod_name}")
        print(f"   4. SSH access: ssh root@<LoadBalancer-IP>")
        print(f"   5. HTTP access: http://<LoadBalancer-IP>/")
        print()
        print("📌 Exposed Ports:")
        print(f"   - Port 22 (SSH): ssh root@<LoadBalancer-IP>")
        print(f"   - Port 80 (HTTP): http://<LoadBalancer-IP>/")

        return True

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False


@dataclass
class Args:
    # 基本配置
    namespace: str = field(default="demo", metadata={"help": "K8s namespace"})
    pod_name: str = field(default="ssh-ubuntu-demo", metadata={"help": "Pod name"})
    image: str = field(default="ubuntu:22.04", metadata={"help": "Container image"})

    network_service_name: str = field(default="ssh-ubuntu-svc", metadata={"help": "Service name"})
    lb_ip: str = field(default=None, metadata={"help": "LoadBalancer IP address (must be in MetalLB pool)"})
    

def main():
    """Main entry point"""
    args = hai.parse_args(Args)

    # Example volume mounts - customize as needed
    # volume_mounts = [
    #     {"host_path": "/tmp/demo", "mount_path": "/data"},
    # ]
    volume_mounts = [
        # {"host_path": "/tmp/demo", "mount_path": "/data"},
    ]

    success = launch_ssh_ubuntu(
        namespace=args.namespace,
        pod_name=args.pod_name,
        service_name=args.network_service_name,
        image=args.image,
        volume_mounts=volume_mounts,
        load_balancer_ip=args.lb_ip,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
