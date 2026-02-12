"""
Migration script: Add new fields to Image table and migrate existing data
"""
import sys
from pathlib import Path
import json

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import init_db, engine
from db.models import Image
from sqlmodel import Session, select


def migrate_images():
    """Migrate existing images with default tags and recommended resources"""
    # Initialize database (automatically creates new columns)
    init_db()

    with Session(engine) as session:
        images = session.exec(select(Image)).all()

        for image in images:
            print(f"Processing image: {image.name}")

            # Infer tags based on image name
            tags = []
            name_lower = image.name.lower()

            if 'hai-openclaw' in name_lower:
                tags.append('openclaw')
            elif 'hai-opendrsai' in name_lower:
                tags.append('opendrsai')
            elif any(prefix in name_lower for prefix in ['ubuntu', 'centos', 'debian', 'alpine', 'fedora', 'rhel', 'almalinux']):
                tags.append('system')

            if image.gpu_required:
                tags.append('gpu')

            # Set tags if any were inferred
            if tags and not image.tags:
                image.tags = json.dumps(tags)
                print(f"  - Set tags: {tags}")

            # Set default recommended resources if not set
            if not image.recommended_resources:
                recommended = {
                    "cpu": 2.0,
                    "memory": 4.0,
                    "gpu": 1 if image.gpu_required else 0
                }
                image.recommended_resources = json.dumps(recommended)
                print(f"  - Set recommended resources: {recommended}")

            # Set default version if not set
            if not image.version:
                image.version = "latest"
                print(f"  - Set version: latest")

            session.add(image)

        session.commit()
        print(f"\n✓ Migration completed: Updated {len(images)} images")


if __name__ == "__main__":
    print("Starting image metadata migration...")
    migrate_images()
