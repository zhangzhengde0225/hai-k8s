"""
Migrate existing containers to use ApplicationConfig

This script:
1. Creates ApplicationConfig entries for existing containers
2. Links containers to their respective configs
3. Infers application_id from image names

Author: Zhengde ZHANG
"""
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import init_db, engine
from db.models import Container, ApplicationConfig, Image, ConfigStatus, ContainerStatus
from sqlmodel import Session, select


def infer_app_id(image_name: str) -> str:
    """Infer application ID from image name"""
    name_lower = image_name.lower()

    # Map image prefixes to application IDs
    if 'openclaw' in name_lower or 'hai-openclaw' in name_lower:
        return 'openclaw'
    elif 'opendrsai' in name_lower or 'hai-opendrsai' in name_lower:
        return 'opendrsai'
    else:
        # Default to generic container service
        return 'container'


def migrate_existing_containers():
    """Migrate existing containers to use ApplicationConfig"""
    print("Starting migration...")

    init_db()

    with Session(engine) as session:
        # Get all non-deleted containers
        containers = session.exec(
            select(Container).where(Container.status != ContainerStatus.DELETED)
        ).all()

        print(f"Found {len(containers)} containers to migrate")

        migrated_count = 0
        skipped_count = 0

        for container in containers:
            # Skip if already has config_id
            if container.config_id is not None:
                print(f"  Skipped (already migrated): {container.name} (ID: {container.id})")
                skipped_count += 1
                continue

            # Get image info
            image = session.get(Image, container.image_id)
            if not image:
                print(f"  Warning: Container {container.name} has invalid image_id {container.image_id}")
                continue

            # Infer application ID
            app_id = infer_app_id(image.name)

            # Create a config for this container
            config = ApplicationConfig(
                config_name=f"Migrated-{container.name}",
                description=f"Auto-migrated from container '{container.name}' (ID: {container.id})",
                user_id=container.user_id,
                application_id=app_id,
                image_id=container.image_id,
                cpu_request=container.cpu_request,
                memory_request=container.memory_request,
                gpu_request=container.gpu_request,
                ssh_enabled=container.ssh_enabled,
                storage_path=None,  # Not available in old containers
                status=ConfigStatus.VALIDATED,
                is_default=False,
                created_at=container.created_at,
                updated_at=datetime.utcnow(),
            )

            session.add(config)
            session.flush()  # Get config.id

            # Link container to config
            container.config_id = config.id
            container.application_id = app_id
            container.updated_at = datetime.utcnow()
            session.add(container)

            print(f"  Migrated: {container.name} -> Config '{config.config_name}' (App: {app_id})")
            migrated_count += 1

        session.commit()

        print("\nMigration Summary:")
        print(f"  Migrated: {migrated_count} containers")
        print(f"  Skipped: {skipped_count} containers (already migrated)")
        print("Migration completed successfully!")


def verify_migration():
    """Verify migration results"""
    print("\nVerifying migration...")

    with Session(engine) as session:
        # Check containers
        total_containers = len(session.exec(
            select(Container).where(Container.status != ContainerStatus.DELETED)
        ).all())

        containers_with_config = len(session.exec(
            select(Container).where(
                Container.status != ContainerStatus.DELETED,
                Container.config_id.isnot(None)
            )
        ).all())

        containers_without_config = total_containers - containers_with_config

        # Check configs
        total_configs = len(session.exec(
            select(ApplicationConfig).where(ApplicationConfig.status != ConfigStatus.ARCHIVED)
        ).all())

        print("\nVerification Results:")
        print(f"  Total active containers: {total_containers}")
        print(f"  Containers with config: {containers_with_config}")
        print(f"  Containers without config: {containers_without_config}")
        print(f"  Total active configs: {total_configs}")

        if containers_without_config == 0:
            print("\n✓ All containers successfully migrated!")
        else:
            print(f"\n⚠ Warning: {containers_without_config} containers still need migration")


if __name__ == "__main__":
    # Check for backup reminder
    print("=" * 60)
    print("DATABASE MIGRATION SCRIPT")
    print("=" * 60)
    print("\nIMPORTANT: Make sure you have backed up the database!")
    print("Backup command: cp haik8s/backend/db/haik8s.db haik8s/backend/db/haik8s.db.backup")
    print()

    response = input("Have you backed up the database? (yes/no): ").strip().lower()
    if response != 'yes':
        print("Migration cancelled. Please backup the database first.")
        sys.exit(1)

    print()
    migrate_existing_containers()
    verify_migration()
