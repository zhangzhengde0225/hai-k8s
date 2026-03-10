#!/usr/bin/env python3
"""
Launch SSH Ubuntu K8s Pod with Network Mounts - Simplified Demo

This script creates a minimal K8s pod focused on demonstrating network volume mounts.
Other features are simplified or omitted.

Author: Based on launch_openclaw.py
"""
import sys
from pathlib import Path
from typing import Optional, List

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import hepai as hai
from kubernetes import client
from config import Config
from k8s_service.client import init_k8s_client, get_core_v1, ensure_namespace
from dataclasses import dataclass, field


def create_pod_with_network_mount(
    namespace: str,
    name: str,
    image: str = "ubuntu:22.04",
    cpu: str = "0.5",
    memory: str = "512Mi",
    gpu: int = 0,
    root_password: str = "test123",
    # User mount configuration
    enable_user_mounts: bool = False,
    custom_user: str = None,
    custom_uid: int = None,
    custom_gid: int = None,
    custom_home: str = None,
    enable_sudo: bool = True,
    # Volume mount configuration
    enable_volume_mounts: bool = False,
    volume_mounts: list = None,
    # Network mount configuration
    enable_network_mounts: bool = True,
    macvlan_network: str = None,
    macvlan_ip: str = None,
) -> client.V1Pod:
    """
    Create a pod with flexible configuration options (macvlan network optional).

    Args:
        namespace: K8s namespace
        name: Pod name
        image: Container image (default: ubuntu:22.04)
        cpu: CPU request (e.g., "0.5", "2.0")
        memory: Memory request (e.g., "512Mi", "4Gi")
        gpu: Number of GPU cards
        root_password: Root password for SSH
        enable_user_mounts: Enable custom user configuration
        custom_user: Username for home directory
        custom_uid: UID for custom user
        custom_gid: GID for custom user
        custom_home: Home directory for custom user
        enable_sudo: Enable passwordless sudo for user
        enable_volume_mounts: Enable additional volume mounts
        volume_mounts: List of volume mounts [{"host_path": "/path", "mount_path": "/path"}]
        enable_network_mounts: Enable macvlan network attachment (default: True)
        macvlan_network: Macvlan NetworkAttachmentDefinition name (e.g., "macvlan-conf-same-subnet")
        macvlan_ip: Specific IP address for macvlan interface (optional, e.g., "10.5.6.201")
    """
    v1 = get_core_v1()

    # Build resource requirements
    resource_requests = {
        "cpu": cpu,
        "memory": memory,
    }
    resource_limits = {
        "cpu": str(float(cpu) * 2),  # Limit is 2x request
        "memory": memory,
    }

    # Add GPU if requested
    if gpu > 0:
        resource_requests["nvidia.com/gpu"] = str(gpu)
        resource_limits["nvidia.com/gpu"] = str(gpu)

    resources = client.V1ResourceRequirements(
        requests=resource_requests,
        limits=resource_limits,
    )

    # Build startup command
    startup_commands = []

    # Install basic packages
    startup_commands.append("apt-get update && apt-get install -y openssh-server iproute2 iputils-ping net-tools sudo")

    # Setup SSH
    startup_commands.append("mkdir -p /var/run/sshd")
    startup_commands.append(f"echo 'root:{root_password}' | chpasswd")
    startup_commands.append("sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config")
    startup_commands.append("sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config")

    # Custom user setup
    if enable_user_mounts and custom_user:
        # Create group and user with custom home directory
        startup_commands.append(f"groupadd -g {custom_gid} {custom_user} || true")

        # Use custom home if specified, otherwise use default /home/{custom_user}
        home_dir = custom_home if custom_home else f"/home/{custom_user}"

        # Create user with specified home directory (don't create home if it exists via mount)
        # Use -M flag to not create home directory, then use -d to specify home path
        startup_commands.append(f"useradd -M -d {home_dir} -u {custom_uid} -g {custom_gid} -s /bin/bash {custom_user} 2>/dev/null || true")

        # Create home directory only if it doesn't exist
        startup_commands.append(f"mkdir -p {home_dir}")

        # Create .bashrc only if it doesn't exist (preserve existing user config)
        startup_commands.append(f"[ ! -f {home_dir}/.bashrc ] && touch {home_dir}/.bashrc || true")

        # Set ownership only if directory is empty or newly created
        # This avoids changing permissions on mounted volumes
        startup_commands.append(f"if [ -z \"$(ls -A {home_dir} 2>/dev/null)\" ]; then chown -R {custom_uid}:{custom_gid} {home_dir}; fi")

        # Set password for the custom user
        startup_commands.append(f"echo '{custom_user}:{root_password}' | chpasswd")

        # Add sudo permission if enabled
        if enable_sudo:
            startup_commands.append(f"echo '{custom_user} ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers")

        # Configure root to auto-switch to custom user on SSH login
        # Use echo with multiple lines instead of heredoc
        startup_commands.append(f"echo '# Auto-switch to custom user' > /root/.bashrc")
        startup_commands.append(f"echo 'if [ \"$USER\" = \"root\" ] && [ -n \"$SSH_CONNECTION\" ]; then' >> /root/.bashrc")
        startup_commands.append(f"echo '    exec su - {custom_user}' >> /root/.bashrc")
        startup_commands.append(f"echo 'fi' >> /root/.bashrc")

    # Network info display
    startup_commands.append("echo 'Container started'")
    startup_commands.append("echo 'Network interfaces:'")
    startup_commands.append("ip addr show")

    # Start SSH server
    startup_commands.append("echo 'Starting SSH server...'")
    startup_commands.append("/usr/sbin/sshd -D")

    command_script = " && \\\n".join(startup_commands)

    # Build volume mounts for container
    container_volume_mounts = []
    volumes = []

    if enable_volume_mounts and volume_mounts:
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
                            type="DirectoryOrCreate"
                        ),
                    )
                )

    # Container configuration
    container = client.V1Container(
        name="main",
        image=image,
        image_pull_policy="IfNotPresent",
        command=["/bin/bash", "-c", command_script],
        ports=[client.V1ContainerPort(container_port=22)],
        resources=resources,
        volume_mounts=container_volume_mounts if container_volume_mounts else None,
        security_context=client.V1SecurityContext(
            capabilities=client.V1Capabilities(
                add=["NET_ADMIN"] if enable_network_mounts else None
            ),
            privileged=True,
            run_as_user=0,  # Always run as root to execute setup commands
        ),
    )

    # Pod spec
    pod_spec = client.V1PodSpec(
        containers=[container],
        volumes=volumes if volumes else None,
        restart_policy="Always",
    )

    # Pod metadata with optional network annotation
    annotations = {}
    if enable_network_mounts and macvlan_network:
        # If macvlan_ip is specified, use JSON format with IP specification
        if macvlan_ip:
            import json
            # For JSON format with IP, only use the network name (not namespace/name format)
            # Multus will search in current namespace first, then default namespace
            network_config = [{
                "name": macvlan_network,
                "namespace": "default",  # Explicitly specify the namespace
                "ips": [macvlan_ip]
            }]
            annotations["k8s.v1.cni.cncf.io/networks"] = json.dumps(network_config)
        else:
            # Simple string format without IP specification
            # For string format, use namespace/name syntax for cross-namespace reference
            if '/' not in macvlan_network:
                macvlan_network_ref = f"default/{macvlan_network}"
            else:
                macvlan_network_ref = macvlan_network
            annotations["k8s.v1.cni.cncf.io/networks"] = macvlan_network_ref

    pod_metadata = client.V1ObjectMeta(
        name=name,
        labels={"app": name, "demo": "basic-pod"},
        annotations=annotations if annotations else None,
    )

    pod = client.V1Pod(
        api_version="v1",
        kind="Pod",
        metadata=pod_metadata,
        spec=pod_spec,
    )

    return v1.create_namespaced_pod(namespace=namespace, body=pod)


def launch_ubuntu(
    namespace: str = "demo",
    pod_name: str = "ssh-ubuntu-demo",
    image: str = "ubuntu:22.04",
    cpu: str = "0.5",
    memory: str = "512Mi",
    gpu: int = 0,
    root_password: str = "test123",
    # User mount
    enable_user_mounts: bool = False,
    custom_user: str = None,
    custom_uid: int = None,
    custom_gid: int = None,
    custom_home: str = None,
    enable_sudo: bool = True,
    # Volume mounts
    enable_volume_mounts: bool = False,
    volume_mounts: list = None,
    # Network
    enable_network_mounts: bool = True,
    macvlan_network: str = None,
    macvlan_ip: str = None,
):
    """
    Launch a configurable SSH Ubuntu pod with optional macvlan network.

    Args:
        namespace: K8s namespace
        pod_name: Pod name
        image: Container image
        cpu: CPU request
        memory: Memory request
        gpu: Number of GPUs
        root_password: Root password for SSH
        enable_user_mounts: Enable custom user configuration
        custom_user: Custom username
        custom_uid: Custom user UID
        custom_gid: Custom user GID
        custom_home: Custom home directory
        enable_sudo: Enable passwordless sudo
        enable_volume_mounts: Enable volume mounts
        volume_mounts: List of volume mounts [{"host_path": "/path", "mount_path": "/path"}]
        enable_network_mounts: Enable macvlan network (default: True)
        macvlan_network: NetworkAttachmentDefinition name
        macvlan_ip: Specific IP address for macvlan (optional)
    """
    print(f"🚀 Launching SSH Ubuntu pod")
    print(f"   Namespace: {namespace}")
    print(f"   Pod name: {pod_name}")
    print(f"   Image: {image}")
    print(f"   Resources: CPU={cpu}, Memory={memory}, GPU={gpu}")

    if enable_user_mounts:
        home_display = custom_home if custom_home else f"/home/{custom_user}"
        print(f"   👤 Custom User: {custom_user} (UID={custom_uid}, GID={custom_gid}, home={home_display}, sudo={enable_sudo})")

    if enable_volume_mounts and volume_mounts:
        print(f"   📁 Volume mounts:")
        for mount in volume_mounts:
            print(f"     - {mount.get('host_path')} -> {mount.get('mount_path')}")

    if enable_network_mounts and macvlan_network:
        print(f"   🌐 Macvlan Network: {macvlan_network}")
        if macvlan_ip:
            print(f"   📍 Macvlan IP: {macvlan_ip}")
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
            cpu=cpu,
            memory=memory,
            gpu=gpu,
            root_password=root_password,
            enable_user_mounts=enable_user_mounts,
            custom_user=custom_user,
            custom_uid=custom_uid,
            custom_gid=custom_gid,
            custom_home=custom_home,
            enable_sudo=enable_sudo,
            enable_volume_mounts=enable_volume_mounts,
            volume_mounts=volume_mounts,
            enable_network_mounts=enable_network_mounts,
            macvlan_network=macvlan_network,
            macvlan_ip=macvlan_ip,
        )
        print(f"   ✅ Pod created successfully")

        print()
        print("🎉 SSH Ubuntu pod launched successfully!")
        print()
        print("📋 Configuration Summary:")
        print(f"   Namespace: {namespace}")
        print(f"   Pod Name: {pod_name}")
        print(f"   SSH User: root")
        print(f"   SSH Password: {root_password}")

        if enable_user_mounts:
            print(f"   Custom User: {custom_user}")
            print(f"   User Password: {root_password}")

        if enable_volume_mounts and volume_mounts:
            print(f"   Volume Mounts: {len(volume_mounts)} mount(s)")

        if enable_network_mounts and macvlan_network:
            print(f"   Network: macvlan ({macvlan_network})")
            if macvlan_ip:
                print(f"   Macvlan IP: {macvlan_ip}")

        print()
        print("💡 Next Steps:")
        print(f"   1. Check pod status: kubectl get pods -n {namespace} {pod_name} -o wide")
        print(f"   2. View pod logs: kubectl logs -n {namespace} {pod_name}")

        if enable_network_mounts:
            print(f"   3. Get macvlan IP: kubectl exec -n {namespace} {pod_name} -- ip addr show net1")
            if macvlan_ip:
                print(f"   4. SSH access: ssh root@{macvlan_ip}")
            else:
                print(f"   4. SSH access: ssh root@<macvlan-ip>")
            print(f"   5. Note: SSH from a different node (not the pod's host node)")
        else:
            print(f"   3. SSH to pod via cluster IP (from within cluster)")

        return True

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


def default_volume_mounts():
    """Example default volume mounts - customize as needed"""
    return [
        {
            "host_path": "/aifs/user/home/zdzhang",  # 修改为实际路径
            "mount_path": "/aifs/user/home/zdzhang",
        },
        {
            "host_path": "/aifs/user/data/zdzhang",  # 修改为实际路径
            "mount_path": "/aifs/user/data/zdzhang",
        },
    ]


@dataclass
class Args:
    # 基本配置
    namespace: str = field(default="demo", metadata={"help": "K8s namespace"})
    pod_name: str = field(default="ssh-ubuntu-demo", metadata={"help": "Pod name"})
    image: str = field(default="ubuntu:22.04", metadata={"help": "Container image"})
    cpu: str = field(default="0.5", metadata={"help": "CPU request (e.g., 0.5, 2.0)"})
    memory: str = field(default="512Mi", metadata={"help": "Memory request (e.g., 512Mi, 4Gi)"})
    gpu: int = field(default=0, metadata={"help": "Number of GPU cards request"})
    root_password: str = field(default="test123", metadata={"help": "Root password for SSH access"})

    # User Mounts
    enable_user_mounts: bool = field(default=False, metadata={"help": "Whether to enable custom user configuration"})
    custom_user: str = field(default="zdzhang", metadata={"help": "Username for custom user"})
    custom_uid: int = field(default=21927, metadata={"help": "UID for custom user"})
    custom_gid: int = field(default=600, metadata={"help": "GID for custom user"})
    custom_home: str = field(default="/aifs/user/home/zdzhang", metadata={"help": "Home directory for custom user"})
    enable_sudo: bool = field(default=True, metadata={"help": "Whether to enable passwordless sudo for the user"})

    # Volume Mounts
    enable_volume_mounts: bool = field(default=False, metadata={"help": "Whether to enable additional volume mounts"})
    volume_mounts: list[dict] = field(default_factory=default_volume_mounts, metadata={"help": "List of volume mounts [{'host_path': '...', 'mount_path': '...'}]"})

    # Network Mounts
    enable_network_mounts: bool = field(default=True, metadata={"help": "Whether to enable macvlan network attachment"})
    macvlan_network: str = field(default="macvlan-conf-same-subnet", metadata={"help": "NetworkAttachmentDefinition name for macvlan"})
    # macvlan_network: str = field(default="macvlan-conf", metadata={"help": "NetworkAttachmentDefinition name for macvlan"})
    macvlan_ip: str = field(default="10.5.6.210", metadata={"help": "Specific IP address for macvlan interface (e.g., 10.5.6.201)"})


def main():
    """Main entry point"""
    args = hai.parse_args(Args)

    # Prepare volume mounts if enabled
    volume_mounts = args.volume_mounts if args.enable_volume_mounts else None

    success = launch_ubuntu(
        namespace=args.namespace,
        pod_name=args.pod_name,
        image=args.image,
        cpu=args.cpu,
        memory=args.memory,
        gpu=args.gpu,
        root_password=args.root_password,
        # User configuration
        enable_user_mounts=args.enable_user_mounts,
        custom_user=args.custom_user,
        custom_uid=args.custom_uid,
        custom_gid=args.custom_gid,
        custom_home=args.custom_home,
        enable_sudo=args.enable_sudo,
        # Volume mounts
        enable_volume_mounts=args.enable_volume_mounts,
        volume_mounts=volume_mounts,
        # Network configuration
        enable_network_mounts=args.enable_network_mounts,
        macvlan_network=args.macvlan_network,
        macvlan_ip=args.macvlan_ip,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
