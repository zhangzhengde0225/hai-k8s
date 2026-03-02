#!/usr/bin/env python3
"""
Launch OpenClaw K8s Service

This script creates a K8s pod and service for the OpenClaw application
with modular configuration for user, volume, and network mounts.

Author: Zhengde ZHANG
"""
import sys
from pathlib import Path
from dataclasses import dataclass, field

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

HERE = Path(__file__).parent

import hepai as hai
from kubernetes import client
from config import Config
from k8s.client import init_k8s_client, get_core_v1, ensure_namespace
from k8s.pods import get_pod_status

from apps.openclaw.create_openclaw_pod import create_openclaw_pod


# ============================================================================
# Pod Creation
# ============================================================================

# def create_openclaw_pod(
#     namespace: str,
#     name: str,
#     image: str,
#     cpu: float,
#     memory: float,
#     gpu: int = 0,
#     root_password: str = "test123",
#     # User configuration
#     enable_user_mounts: bool = False,
#     custom_user: str = None,
#     custom_uid: int = None,
#     custom_gid: int = None,
#     custom_home: str = None,
#     enable_sudo: bool = True,
#     custom_bashrc: str = None,
#     # Volume configuration
#     enable_volume_mounts: bool = False,
#     volume_mounts: list = None,
#     # Network configuration
#     enable_network_mounts: bool = False,
#     macvlan_network: str = None,
#     macvlan_ip: str = None,
#     macvlan_gateway: str = "10.5.6.1",
#     macvlan_subnet: str = "10.5.6.0/24",
#     ssh_enabled: bool = True,
# ) -> client.V1Pod:
#     """
#     Create OpenClaw pod with modular configuration.

#     Args:
#         namespace: K8s namespace
#         name: Pod name
#         image: Container image
#         cpu: CPU cores
#         memory: Memory in GB
#         gpu: Number of GPUs
#         root_password: Root password
#         enable_user_mounts: Enable custom user setup
#         custom_user: Username to create
#         custom_uid: User ID
#         custom_gid: Group ID
#         custom_home: Home directory
#         enable_sudo: Enable sudo for user
#         custom_bashrc: Additional bashrc config
#         enable_volume_mounts: Enable volume mounts
#         volume_mounts: List of volume mounts [{"host_path": "/path", "mount_path": "/path"}]
#         enable_network_mounts: Enable macvlan network
#         macvlan_network: NetworkAttachmentDefinition name
#         macvlan_ip: Specific IP for macvlan
#         macvlan_gateway: Gateway IP for macvlan (default: 10.5.6.1)
#         macvlan_subnet: Subnet for macvlan (default: 10.5.6.0/24)
#         ssh_enabled: Enable SSH service
#     """
#     v1 = get_core_v1()
#     startup_commands = []


#     # -----------------------------
#     # 01 Basic Computing Resources
#     # -----------------------------
#     resources = client.V1ResourceRequirements(
#         requests={
#             "cpu": str(cpu / 2),
#             "memory": f"{int(memory) / 2 * 1024}Mi",
#         },
#         limits={
#             "cpu": str(int(cpu)),
#             "memory": f"{int(memory) * 1024}Mi",
#         },
#     )

#     if gpu > 0:
#         resources.requests["nvidia.com/gpu"] = str(gpu)
#         resources.limits["nvidia.com/gpu"] = str(gpu)

#     # Install basic packages
#     startup_commands.append("apt-get update && apt-get install -y openssh-server iproute2 iputils-ping net-tools sudo htop")

#     # -----------------------------
#     # 02 User Configuration
#     # -----------------------------
    
#     # Set root password
#     startup_commands.append(f"echo 'root:{root_password}' | chpasswd")

#     # Custom user setup
#     if enable_user_mounts and custom_user:
#         startup_commands.append(f"groupadd -g {custom_gid} {custom_user} || true")
        
#         home_dir = custom_home if custom_home else f"/home/{custom_user}"
#         # Use -M flag to not create home directory, then use -d to specify home path
#         startup_commands.append(f"useradd -M -d {home_dir} -u {custom_uid} -g {custom_gid} -s /bin/bash {custom_user} 2>/dev/null || true")
#         # Create home directory only if it doesn't exist
#         startup_commands.append(f"mkdir -p {home_dir} 2>/dev/null || true")
#         # Create .bashrc only if it doesn't exist and we have write permission
#         startup_commands.append(f"[ ! -f {home_dir}/.bashrc ] && touch {home_dir}/.bashrc 2>/dev/null || true")
#         # Set ownership only if directory is empty and we have permission
#         startup_commands.append(f"if [ -z \"$(ls -A {home_dir} 2>/dev/null)\" ]; then chown -R {custom_uid}:{custom_gid} {home_dir} 2>/dev/null || true; fi")
#         # Set password for the custom user
#         startup_commands.append(f"echo '{custom_user}:{root_password}' | chpasswd")
#         # Add sudo permission to custom user if enabled
#         if enable_sudo:
#             startup_commands.append(f"echo '{custom_user} ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers")

#         # # Configure root to auto-switch to custom user on SSH login
#         # startup_commands.append(f"echo '# Auto-switch to custom user' > /root/.bashrc")
#         # startup_commands.append(f"echo 'if [ \"$USER\" = \"root\" ] && [ -n \"$SSH_CONNECTION\" ]; then' >> /root/.bashrc")
#         # startup_commands.append(f"echo '    exec su - {custom_user}' >> /root/.bashrc")
#         # startup_commands.append(f"echo 'fi' >> /root/.bashrc")

#         # Add custom bashrc if provided
#         # if custom_bashrc:
#         #     # Split custom_bashrc into lines and append each line separately
#         #     for line in custom_bashrc.strip().split('\n'):
#         #         if line.strip():  # Skip empty lines
#         #             # Escape single quotes in the line
#         #             line_escaped = line.replace("'", "'\\''")
#         #             startup_commands.append(f"echo '{line_escaped}' >> {home_dir}/.bashrc")

#     # -----------------------------
#     # 03 Network Configuration
#     # -----------------------------
#     # Network info display
#     startup_commands.append("echo 'Container started'")
#     startup_commands.append("echo 'Network interfaces:'")
#     startup_commands.append("ip addr show")

#     # Configure macvlan routing if enabled
#     if enable_network_mounts and macvlan_ip:
#         startup_commands.append('echo "100 net1_table" >> /etc/iproute2/rt_tables')
#         startup_commands.append(f'ip route add default via {macvlan_gateway} dev net1 table net1_table')
#         startup_commands.append(f'ip route add {macvlan_subnet} dev net1 src {macvlan_ip} table net1_table')
#         startup_commands.append(f'ip rule add from {macvlan_ip} table net1_table')

#     # Setup SSH
#     if ssh_enabled:
#         startup_commands.append("mkdir -p /var/run/sshd")
#         startup_commands.append("sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config")
#         startup_commands.append("sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config")
#         # Add SSH keepalive settings to prevent connection drops
#         startup_commands.append("echo 'ClientAliveInterval 60' >> /etc/ssh/sshd_config")
#         startup_commands.append("echo 'ClientAliveCountMax 3' >> /etc/ssh/sshd_config")
#         startup_commands.append("echo 'TCPKeepAlive yes' >> /etc/ssh/sshd_config")
#         # Start SSH server
#         startup_commands.append("echo 'Starting SSH server...'")
#         startup_commands.append("/usr/sbin/sshd -D")

#     command_script = " && \\\n".join(startup_commands)
#     command = ["/bin/bash", "-c", command_script]

#     # Build volume mounts
#     container_volume_mounts = []
#     volumes = []

#     if enable_volume_mounts and volume_mounts:
#         for idx, mount in enumerate(volume_mounts):
#             volume_name = f"volume-{idx}"
#             host_path = mount.get("host_path")
#             mount_path = mount.get("mount_path")

#             if host_path and mount_path:
#                 container_volume_mounts.append(
#                     client.V1VolumeMount(
#                         name=volume_name,
#                         mount_path=mount_path,
#                     )
#                 )

#                 volumes.append(
#                     client.V1Volume(
#                         name=volume_name,
#                         host_path=client.V1HostPathVolumeSource(
#                             path=host_path,
#                             type="Directory"
#                         ),
#                     )
#                 )

#     # Container spec
#     container = client.V1Container(
#         name="main",
#         image=image,
#         command=command,
#         resources=resources,
#         volume_mounts=container_volume_mounts if container_volume_mounts else None,
#         security_context=client.V1SecurityContext(
#             capabilities=client.V1Capabilities(
#                 add=["NET_ADMIN"] if enable_network_mounts else None
#             ),
#             privileged=True,
#             run_as_user=0,
#         ),
#     )

#     # Pod spec
#     pod_spec = client.V1PodSpec(
#         containers=[container],
#         volumes=volumes if volumes else None,
#         restart_policy="Always",
#     )

#     # Pod metadata with optional network annotation
#     annotations = {}
#     if enable_network_mounts and macvlan_network:
#         if macvlan_ip:
#             import json
#             network_config = [{
#                 "name": macvlan_network,
#                 "namespace": "default",
#                 "ips": [macvlan_ip]
#             }]
#             annotations["k8s.v1.cni.cncf.io/networks"] = json.dumps(network_config)
#         else:
#             if '/' not in macvlan_network:
#                 macvlan_network_ref = f"default/{macvlan_network}"
#             else:
#                 macvlan_network_ref = macvlan_network
#             annotations["k8s.v1.cni.cncf.io/networks"] = macvlan_network_ref

#     pod_metadata = client.V1ObjectMeta(
#         name=name,
#         labels={"app": name, "managed-by": "haik8s"},
#         annotations=annotations if annotations else None,
#     )

#     pod = client.V1Pod(
#         api_version="v1",
#         kind="Pod",
#         metadata=pod_metadata,
#         spec=pod_spec,
#     )

#     return v1.create_namespaced_pod(namespace=namespace, body=pod)


# ============================================================================
# Main Launch Function
# ============================================================================

def launch_openclaw(
    namespace: str = None,
    pod_name: str = "hai-openclaw",
    image: str = "hai-openclaw",
    cpu: float = 4.0,
    memory: float = 8.0,
    gpu: int = 0,
    root_password: str = "test123",
    # User configuration
    enable_user_mounts: bool = True,
    custom_user: str = None,
    custom_uid: int = None,
    custom_gid: int = None,
    custom_home: str = None,
    enable_sudo: bool = True,
    custom_bashrc: str = None,
    # Volume configuration
    enable_volume_mounts: bool = False,
    volume_mounts: list = None,
    # Network configuration
    enable_network_mounts: bool = False,
    macvlan_network: str = None,
    macvlan_ip: str = None,
    macvlan_gateway: str = "10.5.6.1",
    macvlan_subnet: str = "10.5.6.0/24",
    ssh_enabled: bool = True,
):
    """
    Launch OpenClaw service with modular configuration.

    Args:
        namespace: K8s namespace
        pod_name: Pod name
        image: Image name from database
        cpu: CPU cores
        memory: Memory in GB
        gpu: Number of GPUs
        root_password: Root password
        enable_user_mounts: Enable custom user setup
        custom_user: Custom username
        custom_uid: Custom UID
        custom_gid: Custom GID
        custom_home: Custom home directory
        enable_sudo: Enable sudo
        custom_bashrc: Additional bashrc
        enable_volume_mounts: Enable volume mounts
        volume_mounts: Volume mounts list
        enable_network_mounts: Enable macvlan network
        macvlan_network: NetworkAttachmentDefinition name
        macvlan_ip: Specific macvlan IP
        macvlan_gateway: Gateway IP for macvlan
        macvlan_subnet: Subnet for macvlan
        ssh_enabled: Enable SSH service
    """
    print(f"🚀 Launching OpenClaw")
    print(f"   Pod: {pod_name}")
    print(f"   Image: {image}")
    print(f"   Resources: CPU={cpu}, Memory={memory}GB, GPU={gpu}")

    if enable_user_mounts and custom_user:
        home_display = custom_home if custom_home else f"/home/{custom_user}"
        print(f"   👤 User: {custom_user} (UID={custom_uid}, GID={custom_gid}, home={home_display})")

    if enable_volume_mounts and volume_mounts:
        print(f"   📁 Volume mounts: {len(volume_mounts)} mount(s)")

    if enable_network_mounts and macvlan_network:
        print(f"   🌐 Macvlan: {macvlan_network}")
        if macvlan_ip:
            print(f"   📍 IP: {macvlan_ip}")
    print()

    # Initialize K8s
    print("☸️  Initializing Kubernetes client...")
    init_k8s_client(Config.KUBECONFIG_PATH)
    print()

    print(f"🏷️  Kubernetes names:")
    print(f"   Namespace: {namespace}")
    print(f"   Pod: {pod_name}")
    print()

    # Check if pod exists
    print("🔍 Checking if pod exists...")
    existing_status = get_pod_status(namespace, pod_name)
    if existing_status:
        print(f"⚠️  Pod already exists: {existing_status}")
        return False
    print("✅ Pod name available")
    print()

    # Create K8s resources
    try:
        print("☸️  Creating Kubernetes resources...")

        # Ensure namespace
        print(f"   Creating namespace: {namespace}")
        ensure_namespace(namespace)

        # Create pod
        print(f"   Creating pod: {pod_name}")
        create_openclaw_pod(
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
            custom_bashrc=custom_bashrc,
            enable_volume_mounts=enable_volume_mounts,
            volume_mounts=volume_mounts,
            enable_network_mounts=enable_network_mounts,
            macvlan_network=macvlan_network,
            macvlan_ip=macvlan_ip,
            macvlan_gateway=macvlan_gateway,
            macvlan_subnet=macvlan_subnet,
            ssh_enabled=ssh_enabled,
        )
        print(f"   ✅ Pod created")

        print()
        print("🎉 OpenClaw launched successfully!")
        print()
        print("📋 Details:")
        print(f"   Namespace: {namespace}")
        print(f"   Pod: {pod_name}")

        if ssh_enabled:
            ssh_user = custom_user if custom_user else "root"
            if enable_network_mounts and macvlan_ip:
                print(f"   SSH: ssh {ssh_user}@{macvlan_ip}")
                print(f"   Password: {root_password}")
            else:
                print(f"   SSH: Waiting for macvlan IP allocation")
                print(f"   Check IP: kubectl get pods -n {namespace} {pod_name} -o wide")

        print()
        print("💡 Tips:")
        print(f"   - Check status: kubectl get pods -n {namespace}")
        print(f"   - View logs: kubectl logs -n {namespace} {pod_name}")

        return True

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


# ============================================================================
# CLI Configuration
# ============================================================================

def default_volume_mounts():
    """Default volume mounts for OpenClaw"""
    return [
        {
            "host_path": "/aifs/user/home/zdzhang", 
            "mount_path": "/aifs/user/home/zdzhang",
        },
        {
            "host_path": "/aifs/user/data/zdzhang",  
            "mount_path": "/aifs/user/data/zdzhang",
        },
    ]


@dataclass
class Args:
    # Basic configuration
    namespace: str = field(default="haik8s-zdzhang", metadata={"help": "K8s namespace"})
    pod_name: str = field(default="hai-openclaw-0", metadata={"help": "Pod name"})
    image: str = field(default="dockerhub.ihep.ac.cn/hepai/hai-openclaw:latest", metadata={"help": "Image name from DB"})
    cpu: float = field(default=4.0, metadata={"help": "CPU cores"})
    memory: float = field(default=8.0, metadata={"help": "Memory in GB"})
    gpu: int = field(default=0, metadata={"help": "Number of GPUs"})
    root_password: str = field(default="test123", metadata={"help": "Root password"})

    # User configuration
    enable_user_mounts: bool = field(default=True, metadata={"help": "Enable custom user"})
    custom_user: str = field(default="zdzhang", metadata={"help": "Custom username"})
    custom_uid: int = field(default=21927, metadata={"help": "Custom UID"})
    custom_gid: int = field(default=600, metadata={"help": "Custom GID"})
    custom_home: str = field(default="/aifs/user/home/zdzhang", metadata={"help": "Custom home directory"})
    enable_sudo: bool = field(default=True, metadata={"help": "Enable sudo"})
    custom_bashrc_file: str = field(default=str(HERE / "bashrc_openclaw.sh"), metadata={"help": "Bashrc file path"})

    # Volume configuration
    enable_volume_mounts: bool = field(default=True, metadata={"help": "Enable volume mounts"})
    volume_mounts: list[dict] = field(default_factory=default_volume_mounts, metadata={"help": "Volume mounts"})

    # Network configuration
    enable_network_mounts: bool = field(default=True, metadata={"help": "Enable macvlan network"})
    macvlan_network: str = field(default="macvlan-conf-same-subnet", metadata={"help": "NetworkAttachmentDefinition name"})
    macvlan_ip: str = field(default="10.5.6.200", metadata={"help": "Specific macvlan IP"})
    macvlan_gateway: str = field(default="10.5.6.1", metadata={"help": "Gateway IP for macvlan"})
    macvlan_subnet: str = field(default="10.5.6.0/24", metadata={"help": "Subnet for macvlan"})
    ssh_enabled: bool = field(default=True, metadata={"help": "Enable SSH"})


def main():
    """Main entry point"""
    args = hai.parse_args(Args)

    # Load custom bashrc from file
    custom_bashrc = None
    if args.custom_bashrc_file and Path(args.custom_bashrc_file).exists():
        try:
            with open(args.custom_bashrc_file, "r") as f:
                custom_bashrc = f.read()
        except Exception as e:
            print(f"Error reading bashrc file: {e}")
            sys.exit(1)

    # Prepare volume mounts
    volume_mounts = args.volume_mounts if args.enable_volume_mounts else None

    success = launch_openclaw(
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
        custom_bashrc=custom_bashrc,
        # Volume configuration
        enable_volume_mounts=args.enable_volume_mounts,
        volume_mounts=volume_mounts,
        # Network configuration
        enable_network_mounts=args.enable_network_mounts,
        macvlan_network=args.macvlan_network,
        macvlan_ip=args.macvlan_ip,
        macvlan_gateway=args.macvlan_gateway,
        macvlan_subnet=args.macvlan_subnet,
        # Service configuration
        ssh_enabled=args.ssh_enabled,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
