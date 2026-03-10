
"""
Launch OpenClaw K8s Service

This script creates a K8s pod and service for the OpenClaw application
with modular configuration for user, volume, and network mounts.

Author: Zhengde ZHANG
"""
import sys
from pathlib import Path
import logging

# Add backend to path
# BACKEND_DIR = Path(__file__).parent.parent.parent
# sys.path.insert(0, str(BACKEND_DIR))

HERE = Path(__file__).parent

from kubernetes import client
from k8s.client import get_core_v1


def create_openclaw_pod(
    namespace: str,
    name: str,
    image: str,
    cpu: float,
    memory: float,
    gpu: int = 0,
    root_password: str = "test123",
    # User configuration
    enable_user_mounts: bool = False,
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
    macvlan_gateway: str = "10.5.8.1",
    macvlan_subnet: str = "10.5.8.0/24",
    ssh_enabled: bool = True,
) -> client.V1Pod:
    """
    Create OpenClaw pod with modular configuration.

    Args:
        namespace: K8s namespace
        name: Pod name
        image: Container image
        cpu: CPU cores
        memory: Memory in GB
        gpu: Number of GPUs
        root_password: Root password
        enable_user_mounts: Enable custom user setup
        custom_user: Username to create
        custom_uid: User ID
        custom_gid: Group ID
        custom_home: Home directory
        enable_sudo: Enable sudo for user
        custom_bashrc: Additional bashrc config
        enable_volume_mounts: Enable volume mounts
        volume_mounts: List of volume mounts [{"host_path": "/path", "mount_path": "/path"}]
        enable_network_mounts: Enable macvlan network
        macvlan_network: NetworkAttachmentDefinition name
        macvlan_ip: Specific IP for macvlan
        macvlan_gateway: Gateway IP for macvlan (default: 10.5.8.1)
        macvlan_subnet: Subnet for macvlan (default: 10.5.8.0/24)
        ssh_enabled: Enable SSH service
    """
    v1 = get_core_v1()
    startup_commands = []


    # -----------------------------
    # 01 Basic Computing Resources
    # -----------------------------
    resources = client.V1ResourceRequirements(
        requests={
            "cpu": str(cpu / 2),
            "memory": f"{int(memory) / 2 * 1024}Mi",
        },
        limits={
            "cpu": str(int(cpu)),
            "memory": f"{int(memory) * 1024}Mi",
        },
    )

    if gpu > 0:
        resources.requests["nvidia.com/gpu"] = str(gpu)
        resources.limits["nvidia.com/gpu"] = str(gpu)

    # Install basic packages
    startup_commands.append("apt-get update && apt-get install -y openssh-server iproute2 iputils-ping net-tools sudo htop")

    # -----------------------------
    # 02 User Configuration
    # -----------------------------
    
    # Set root password
    startup_commands.append(f"echo 'root:{root_password}' | chpasswd")

    # Custom user setup
    if enable_user_mounts and custom_user:
        startup_commands.append(f"groupadd -g {custom_gid} {custom_user} || true")
        
        home_dir = custom_home if custom_home else f"/home/{custom_user}"
        # Use -M flag to not create home directory, then use -d to specify home path
        startup_commands.append(f"useradd -M -d {home_dir} -u {custom_uid} -g {custom_gid} -s /bin/bash {custom_user} 2>/dev/null || true")
        # Create home directory only if it doesn't exist
        startup_commands.append(f"mkdir -p {home_dir} 2>/dev/null || true")
        # Create .bashrc only if it doesn't exist and we have write permission
        startup_commands.append(f"[ ! -f {home_dir}/.bashrc ] && touch {home_dir}/.bashrc 2>/dev/null || true")
        # Set ownership only if directory is empty and we have permission
        startup_commands.append(f"if [ -z \"$(ls -A {home_dir} 2>/dev/null)\" ]; then chown -R {custom_uid}:{custom_gid} {home_dir} 2>/dev/null || true; fi")
        # Set password for the custom user
        startup_commands.append(f"echo '{custom_user}:{root_password}' | chpasswd")
        # Add sudo permission to custom user if enabled
        if enable_sudo:
            startup_commands.append(f"echo '{custom_user} ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers")

        # # Configure root to auto-switch to custom user on SSH login
        # startup_commands.append(f"echo '# Auto-switch to custom user' > /root/.bashrc")
        # startup_commands.append(f"echo 'if [ \"$USER\" = \"root\" ] && [ -n \"$SSH_CONNECTION\" ]; then' >> /root/.bashrc")
        # startup_commands.append(f"echo '    exec su - {custom_user}' >> /root/.bashrc")
        # startup_commands.append(f"echo 'fi' >> /root/.bashrc")

        # Add custom bashrc if provided
        # if custom_bashrc:
        #     # Split custom_bashrc into lines and append each line separately
        #     for line in custom_bashrc.strip().split('\n'):
        #         if line.strip():  # Skip empty lines
        #             # Escape single quotes in the line
        #             line_escaped = line.replace("'", "'\\''")
        #             startup_commands.append(f"echo '{line_escaped}' >> {home_dir}/.bashrc")

    # -----------------------------
    # 03 Network Configuration
    # -----------------------------
    # Network info display
    startup_commands.append("echo 'Container started'")
    startup_commands.append("echo 'Network interfaces:'")
    startup_commands.append("ip addr show")

    startup_commands.append(f"echo ''")
    startup_commands.append(f"echo '---------------------'")
    startup_commands.append(f"echo 'user info:'")
    startup_commands.append(f"echo 'root:{root_password}'")
    startup_commands.append(f"echo '{custom_user}:{root_password}'")
    startup_commands.append(f"echo '---------------------'")
    startup_commands.append(f"echo ' '")

    # Configure macvlan routing if enabled
    if enable_network_mounts and macvlan_ip:
        logging.info(f"Configuring macvlan routing inside the container: {macvlan_gateway}, {macvlan_subnet}, {macvlan_ip}")
        startup_commands.append('grep -q "net1_table" /etc/iproute2/rt_tables || echo "100 net1_table" >> /etc/iproute2/rt_tables')
        startup_commands.append(f'ip route add default via {macvlan_gateway} dev net1 table net1_table 2>/dev/null || true')
        startup_commands.append(f'ip route add {macvlan_subnet} dev net1 src {macvlan_ip} table net1_table 2>/dev/null || true')
        startup_commands.append(f'ip rule add from {macvlan_ip} table net1_table 2>/dev/null || true')

    
    # Setup SSH
    if ssh_enabled:
        startup_commands.append("mkdir -p /var/run/sshd")
        startup_commands.append("sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config")
        startup_commands.append("sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config")
        # Add SSH keepalive settings to prevent connection drops
        startup_commands.append("echo 'ClientAliveInterval 60' >> /etc/ssh/sshd_config")
        startup_commands.append("echo 'ClientAliveCountMax 3' >> /etc/ssh/sshd_config")
        startup_commands.append("echo 'TCPKeepAlive yes' >> /etc/ssh/sshd_config")
        # Start SSH server
        startup_commands.append("echo 'Starting SSH server...'")
        startup_commands.append("/usr/sbin/sshd -D")



    command_script = " && \\\n".join(startup_commands)
    command = ["/bin/bash", "-c", command_script]

    # Build volume mounts
    container_volume_mounts = []
    volumes = []

    if enable_volume_mounts and volume_mounts:
        for idx, mount in enumerate(volume_mounts):
            volume_name = f"volume-{idx}"
            host_path = mount.get("host_path")
            mount_path = mount.get("mount_path")

            if host_path and mount_path:
                container_volume_mounts.append(
                    client.V1VolumeMount(
                        name=volume_name,
                        mount_path=mount_path,
                    )
                )

                volumes.append(
                    client.V1Volume(
                        name=volume_name,
                        host_path=client.V1HostPathVolumeSource(
                            path=host_path,
                            type="DirectoryOrCreate"
                        ),
                    )
                )

    # Container spec
    container = client.V1Container(
        name="main",
        image=image,
        command=command,
        resources=resources,
        volume_mounts=container_volume_mounts if container_volume_mounts else None,
        security_context=client.V1SecurityContext(
            capabilities=client.V1Capabilities(
                add=["NET_ADMIN"] if enable_network_mounts else None
            ),
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

    # Pod metadata with optional network annotation
    annotations = {}
    if enable_network_mounts and macvlan_network:
        if macvlan_ip:
            import json
            network_config = [{
                "name": macvlan_network,
                "namespace": "default",
                "ips": [macvlan_ip]
            }]
            annotations["k8s.v1.cni.cncf.io/networks"] = json.dumps(network_config)
        else:
            if '/' not in macvlan_network:
                macvlan_network_ref = f"default/{macvlan_network}"
            else:
                macvlan_network_ref = macvlan_network
            annotations["k8s.v1.cni.cncf.io/networks"] = macvlan_network_ref

    pod_metadata = client.V1ObjectMeta(
        name=name,
        labels={"app": name, "managed-by": "haik8s"},
        annotations=annotations if annotations else None,
    )

    pod = client.V1Pod(
        api_version="v1",
        kind="Pod",
        metadata=pod_metadata,
        spec=pod_spec,
    )

    return v1.create_namespaced_pod(namespace=namespace, body=pod)
