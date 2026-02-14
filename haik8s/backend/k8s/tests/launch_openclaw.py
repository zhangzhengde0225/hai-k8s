#!/usr/bin/env python3
"""
Launch OpenClaw K8s Service for User zdzhang

This script creates a K8s pod and service for the OpenClaw application
for user zdzhang using the existing HAI-K8S infrastructure.

Author: Zhengde ZHANG
"""
import sys
from pathlib import Path

# Add backend to path
BACKEND_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BACKEND_DIR))

HERE = Path(__file__).parent

from sqlmodel import Session, select
from db.database import init_db
from db.models import User, Image, Container, ContainerStatus
from db.crud import (
    get_user_by_username,
    get_image_by_id,
    create_container,
    check_quota,
)
from config import Config
from k8s.client import init_k8s_client, ensure_namespace
from k8s.pods import get_pod_status
from k8s.services import create_ssh_service
import re


def sanitize_k8s_name(name: str) -> str:
    """
    Sanitize a string to make it Kubernetes-compatible (RFC 1123 label).
    """
    if '@' in name:
        name = name.split('@')[0]

    name = name.lower()
    name = re.sub(r'[^a-z0-9-]', '-', name)
    name = re.sub(r'-+', '-', name)
    name = name.strip('-')

    if not name:
        name = 'user'

    if not name[0].isalnum():
        name = 'u' + name

    if not name[-1].isalnum():
        name = name + '0'

    max_suffix_length = 63 - len(Config.K8S_NAMESPACE_PREFIX)
    if len(name) > max_suffix_length:
        name = name[:max_suffix_length].rstrip('-')
        if name and not name[-1].isalnum():
            name = name.rstrip('-') + '0'

    return name


def make_namespace(username: str) -> str:
    """Generate a Kubernetes-compatible namespace name from username."""
    sanitized = sanitize_k8s_name(username)
    return f"{Config.K8S_NAMESPACE_PREFIX}{sanitized}"


def create_pod_with_user(
    namespace: str,
    name: str,
    image: str,
    cpu: float,
    memory: float,
    gpu: int,
    ssh_enabled: bool = False,
    custom_user: str = None,
    custom_uid: int = None,
    custom_gid: int = None,
    enable_sudo: bool = True,
    custom_bashrc: str = None,
    volume_mounts: list = None,
) -> "client.V1Pod":
    """
    Create a pod with custom user and UID/GID using inject_user module.

    Args:
        namespace: K8s namespace
        name: Pod name
        image: Container image
        cpu: CPU cores
        memory: Memory in GB
        gpu: Number of GPUs
        ssh_enabled: Whether to enable SSH
        custom_user: Username to create (e.g., "user")
        custom_uid: User ID (e.g., 21927)
        custom_gid: Group ID (e.g., 600)
        enable_sudo: Whether to grant sudo privileges to the user
        custom_bashrc: Additional .bashrc configuration to append
        volume_mounts: List of volume mounts, each dict with 'host_path' and 'mount_path'
                       Example: [
                           {"host_path": "/aifs/user/home/zdzhang", "mount_path": "/home/zdzhang"},
                           {"host_path": "/aifs/data", "mount_path": "/data"}
                       ]
    """
    from kubernetes import client
    from k8s.client import get_core_v1
    from inject_user import generate_user_injection_script_with_custom_bashrc

    v1 = get_core_v1()

    # Build resource requests
    resources = client.V1ResourceRequirements(
        requests={
            "cpu": str(cpu/2),
            "memory": f"{int(memory)/2*1024}Mi",
        },
        limits={
            "cpu": str(int(cpu)),
            "memory": f"{int(memory)*1024}Mi",
        },
    )

    if gpu > 0:
        resources.requests["nvidia.com/gpu"] = str(gpu)
        resources.limits["nvidia.com/gpu"] = str(gpu)

    # Build startup script if custom user is specified
    if custom_user and custom_uid and custom_gid:
        # Use inject_user module to generate the script
        startup_script = generate_user_injection_script_with_custom_bashrc(
            username=custom_user,
            uid=custom_uid,
            gid=custom_gid,
            ssh_enabled=ssh_enabled,
            enable_sudo=enable_sudo,
            additional_bashrc_config=custom_bashrc,
        )
        command = ["/bin/bash", "-c", startup_script]
    else:
        # Original behavior without custom user
        if ssh_enabled:
            command = None  # Use image's default CMD
        else:
            command = ["/bin/bash", "-c", "tail -f /dev/null"]

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
                            # type="DirectoryOrCreate",
                            type="Directory"  # Use Directory to avoid permission issues; ensure host path exists
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
            privileged=True,  # Required for creating users and installing packages
            run_as_user=0,    # Run as root initially to create users
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
        labels={"app": name, "managed-by": "haik8s"},
    )

    pod = client.V1Pod(
        api_version="v1",
        kind="Pod",
        metadata=pod_metadata,
        spec=pod_spec,
    )

    return v1.create_namespaced_pod(namespace=namespace, body=pod)


def find_available_nodeport_enhanced(session, range_start: int, range_end: int) -> int:
    """
    Find an available NodePort by checking both database and K8s cluster.

    This is an enhanced version that checks:
    1. Database records (containers.ssh_node_port)
    2. Actual K8s services using NodePort
    """
    from kubernetes.client.rest import ApiException
    from k8s.client import get_core_v1

    # Get ports used in database
    from sqlmodel import select
    statement = select(Container.ssh_node_port).where(
        Container.ssh_node_port.isnot(None),
        Container.status.in_([ContainerStatus.CREATING, ContainerStatus.RUNNING])
    )
    db_used_ports = set(session.exec(statement).all())
    print(f"   Ports used in DB: {sorted(db_used_ports) if db_used_ports else 'none'}")

    # Get ports used in K8s cluster
    k8s_used_ports = set()
    try:
        v1 = get_core_v1()
        services = v1.list_service_for_all_namespaces()
        for svc in services.items:
            if svc.spec.type == "NodePort" and svc.spec.ports:
                for port in svc.spec.ports:
                    if port.node_port:
                        k8s_used_ports.add(port.node_port)
        print(f"   Ports used in K8s: {sorted(k8s_used_ports) if k8s_used_ports else 'none'}")
    except ApiException as e:
        print(f"   ⚠️  Warning: Could not query K8s services: {e}")
        print(f"   Falling back to DB-only check")

    # Combine both sets
    all_used_ports = db_used_ports | k8s_used_ports

    # Find first available port
    for port in range(range_start, range_end + 1):
        if port not in all_used_ports:
            print(f"   ✅ Found available port: {port}")
            return port

    return None


def launch_openclaw(
    username: str = "zdzhang@ihep.ac.cn",
    container_name: str = "openclaw",
    image_name: str = "hai-openclaw",
    cpu: float = 4.0,
    memory: float = 8.0,
    gpu: int = 0,
    ssh_enabled: bool = True,
    custom_user: str = None,
    custom_uid: int = None,
    custom_gid: int = None,
    enable_sudo: bool = True,
    custom_bashrc: str = None,
    volume_mounts: list = None,
):
    """
    Launch OpenClaw service for a user.

    Args:
        username: Username to launch service for
        container_name: Name of the container
        image_name: Name of the image to use (must exist in DB)
        cpu: CPU cores to allocate
        memory: Memory in GB to allocate
        gpu: Number of GPUs to allocate
        ssh_enabled: Whether to enable SSH access
        custom_user: Custom username to create in container (e.g., "user")
        custom_uid: Custom UID for the user (e.g., 21927)
        custom_gid: Custom GID for the user (e.g., 600)
        enable_sudo: Whether to grant sudo privileges to the user
        custom_bashrc: Additional .bashrc configuration to append
        volume_mounts: List of volume mounts [{"host_path": "/path", "mount_path": "/path"}]
    """
    print(f"🚀 Launching OpenClaw for user: {username}")
    print(f"   Container name: {container_name}")
    print(f"   Resources: CPU={cpu}, Memory={memory}GB, GPU={gpu}")
    print(f"   SSH enabled: {ssh_enabled}")
    if custom_user and custom_uid and custom_gid:
        print(f"   Custom user: {custom_user} (UID: {custom_uid}, GID: {custom_gid})")
        print(f"   Sudo enabled: {enable_sudo}")
    if volume_mounts:
        print(f"   Volume mounts:")
        for mount in volume_mounts:
            print(f"     - {mount.get('host_path')} -> {mount.get('mount_path')}")
    print()

    # Initialize DB and K8s client
    print("📦 Initializing database...")
    init_db()

    print("☸️  Initializing Kubernetes client...")
    init_k8s_client(Config.KUBECONFIG_PATH)
    print()

    # Import engine after init_db() has been called
    from db.database import engine

    with Session(engine) as session:
        # Get user
        print(f"👤 Looking up user: {username}")
        user = get_user_by_username(session, username)
        if not user:
            print(f"❌ Error: User '{username}' not found in database")
            print("   Please create the user first or check the username")
            return False
        print(f"✅ User found: {user.username} (ID: {user.id}, Role: {user.role})")
        print(f"   Quota: CPU={user.cpu_quota}, Memory={user.memory_quota}GB, GPU={user.gpu_quota}")
        print()

        # Get image
        print(f"🐳 Looking up image: {image_name}")
        statement = select(Image).where(Image.name == image_name, Image.is_active == True)
        image = session.exec(statement).first()
        if not image:
            print(f"❌ Error: Image '{image_name}' not found or inactive")
            print("   Available images:")
            all_images = session.exec(select(Image).where(Image.is_active == True)).all()
            for img in all_images:
                print(f"   - {img.name}: {img.registry_url}")
            return False
        print(f"✅ Image found: {image.name}")
        print(f"   Registry URL: {image.registry_url}")
        print(f"   Description: {image.description}")
        print()

        # Check quota
        print("📊 Checking user quota...")
        ok, msg = check_quota(session, user, cpu, memory, gpu)
        if not ok:
            print(f"❌ Quota check failed: {msg}")
            return False
        print("✅ Quota check passed")
        print()

        # Generate K8s names
        namespace = make_namespace(username)
        sanitized_username = sanitize_k8s_name(username)
        pod_name = f"{sanitized_username}-{container_name}"
        service_name = f"{pod_name}-ssh" if ssh_enabled else None

        print(f"🏷️  Kubernetes resource names:")
        print(f"   Namespace: {namespace}")
        print(f"   Pod name: {pod_name}")
        if service_name:
            print(f"   Service name: {service_name}")
        print()

        # Check if pod already exists
        print("🔍 Checking if pod already exists...")
        existing_status = get_pod_status(namespace, pod_name)
        if existing_status:
            print(f"⚠️  Warning: Pod already exists with status: {existing_status}")
            print("   Please delete the existing pod first or use a different container name")
            return False
        print("✅ Pod name is available")
        print()

        # Create DB record
        print("💾 Creating database record...")
        container = create_container(
            session,
            name=container_name,
            user_id=user.id,
            image_id=image.id,
            k8s_namespace=namespace,
            k8s_pod_name=pod_name,
            k8s_service_name=service_name,
            cpu_request=cpu,
            memory_request=memory,
            gpu_request=gpu,
            ssh_enabled=ssh_enabled,
            ssh_node_port=None,  # LoadBalancer doesn't use NodePort
            status=ContainerStatus.CREATING,
        )
        print(f"✅ Container record created (ID: {container.id})")
        print()

        # Create K8s resources
        try:
            print("☸️  Creating Kubernetes resources...")

            # Ensure namespace exists
            print(f"   Creating/verifying namespace: {namespace}")
            ensure_namespace(namespace)

            # Create pod
            print(f"   Creating pod: {pod_name}")
            create_pod_with_user(
                namespace=namespace,
                name=pod_name,
                image=image.registry_url,
                cpu=cpu,
                memory=memory,
                gpu=gpu,
                ssh_enabled=ssh_enabled,
                custom_user=sanitized_username,
                custom_uid=custom_uid,
                custom_gid=custom_gid,
                enable_sudo=enable_sudo,
                custom_bashrc=custom_bashrc,
                volume_mounts=volume_mounts,
            )
            print(f"   ✅ Pod created successfully")

            # Create SSH LoadBalancer service if enabled
            lb_ip = None
            if ssh_enabled:
                print(f"   Creating SSH LoadBalancer service: {service_name}")
                from inject_ssh_loadbalancer import (
                    create_ssh_loadbalancer_service,
                    get_loadbalancer_ip
                )

                # Create LoadBalancer Service
                service = create_ssh_loadbalancer_service(
                    namespace=namespace,
                    pod_name=pod_name,
                    service_name=service_name,
                )
                print(f"   ✅ SSH LoadBalancer service created")

                # Wait for LoadBalancer IP allocation
                print(f"   ⏳ Waiting for LoadBalancer IP allocation (MetalLB)...")
                lb_ip = get_loadbalancer_ip(namespace, service_name, timeout=60)
                if lb_ip:
                    print(f"   ✅ LoadBalancer IP allocated: {lb_ip}")
                else:
                    print(f"   ⚠️  Warning: LoadBalancer IP not allocated yet")
                    print(f"   It may take a few moments. Check with:")
                    print(f"   kubectl get svc -n {namespace} {service_name}")

            print()
            print("🎉 OpenClaw service launched successfully!")
            print()
            print("📋 Service Details:")
            print(f"   Container ID: {container.id}")
            print(f"   Container Name: {container.name}")
            print(f"   Status: {container.status}")
            print(f"   Namespace: {namespace}")
            print(f"   Pod Name: {pod_name}")

            if ssh_enabled:
                if lb_ip:
                    ssh_user = custom_user if custom_user else "root"
                    ssh_command = f"ssh {ssh_user}@{lb_ip}"
                    print(f"   SSH Command: {ssh_command}")
                    print(f"   LoadBalancer IP: {lb_ip}")
                    if custom_user:
                        print(f"   Note: User '{custom_user}' password needs to be set manually in the container")
                else:
                    print(f"   Service Name: {service_name}")
                    print(f"   ⚠️  LoadBalancer IP pending allocation")
                    print(f"   Check with: kubectl get svc -n {namespace} {service_name}")

            print()
            print("💡 Tips:")
            print("   - Use 'kubectl get pods -n {0}' to check pod status".format(namespace))
            print("   - Use 'kubectl logs -n {0} {1}' to view pod logs".format(namespace, pod_name))
            print("   - The pod may take a few minutes to start (pulling image, etc.)")
            if custom_user and custom_uid and custom_gid:
                print(f"   - Custom user '{custom_user}' has been created with UID {custom_uid} and GID {custom_gid}")
                print(f"   - To set password for '{custom_user}', exec into the container and run: passwd {custom_user}")
                print(f"   - Exec command: kubectl exec -it -n {namespace} {pod_name} -- /bin/bash")

            return True

        except Exception as e:
            print(f"❌ Error creating Kubernetes resources: {str(e)}")
            print(f"   Updating container status to FAILED...")
            from db.crud import update_container
            update_container(session, container.id, status=ContainerStatus.FAILED)
            return False


def main():
    """Main entry point"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Launch OpenClaw K8s service for a user",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--username",
        default="zdzhang@ihep.ac.cn",
        help="Username to launch service for (default: zdzhang@ihep.ac.cn)",
    )
    parser.add_argument(
        "--container-name",
        default="hai-openclaw",
        help="Container name (default: openclaw)",
    )
    parser.add_argument(
        "--image-name",
        default="hai-openclaw",
        help="Image name from database (default: hai-openclaw)",
    )
    parser.add_argument(
        "--cpu",
        type=float,
        default=4.0,
        help="CPU cores to allocate (default: 4.0)",
    )
    parser.add_argument(
        "--memory",
        type=float,
        default=8.0,
        help="Memory in GB to allocate (default: 8.0)",
    )
    parser.add_argument(
        "--gpu",
        type=int,
        default=0,
        help="Number of GPUs to allocate (default: 0)",
    )
    parser.add_argument(
        "--no-ssh",
        action="store_false",
        help="Disable SSH access",
    )
    parser.add_argument(
        "--custom-user",
        type=str,
        default=None,
        help="Custom username to create in container (e.g., user)",
    )
    parser.add_argument(
        "--custom-uid",
        type=int,
        default=21927,
        help="Custom UID for the user (e.g., 21927)",
    )
    parser.add_argument(
        "--custom-gid",
        type=int,
        default=600,
        help="Custom GID for the user (e.g., 600)",
    )
    parser.add_argument(
        "--enable-sudo",
        action="store_true",
        default=True,
        help="Grant sudo privileges to the user (default: enabled)",
    )
    parser.add_argument(
        "--no-sudo",
        dest="enable_sudo",
        action="store_false",
        help="Disable sudo privileges for the user",
    )
    parser.add_argument(
        "--custom-bashrc",
        type=str,
        default=f"@{HERE}/bashrc_openclaw.sh",
        help="Additional .bashrc configuration (inline string or @file path)",
    )

    args = parser.parse_args()

    # Handle custom bashrc from file
    custom_bashrc = args.custom_bashrc
    if custom_bashrc and custom_bashrc.startswith("@"):
        # Load from file
        bashrc_file = custom_bashrc[1:]
        try:
            with open(bashrc_file, "r") as f:
                custom_bashrc = f.read()
        except Exception as e:
            print(f"Error reading bashrc file {bashrc_file}: {e}")
            sys.exit(1)

    # Mount Volumes for OpenClaw (example)
    volume_mounts = [
        # {"host_path": "/aifs/user/home", "mount_path": "/home"},
        {"host_path": "/aifs/user/home/zdzhang", "mount_path": "/home/zdzhang"},
        # {"host_path": "/aifs/user/home/zdzhang/.hai-openclaw", "mount_path": "/home/zdzhang/.hai-openclaw"},
        # {"host_path": "/aifs/data", "mount_path": "/data"}
    ]

    success = launch_openclaw(
        username=args.username,
        container_name=args.container_name,
        image_name=args.image_name,
        cpu=args.cpu,
        memory=args.memory,
        gpu=args.gpu,
        ssh_enabled=not args.no_ssh,
        custom_uid=args.custom_uid,
        custom_gid=args.custom_gid,
        enable_sudo=args.enable_sudo,
        custom_bashrc=custom_bashrc,
        volume_mounts=volume_mounts,
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
