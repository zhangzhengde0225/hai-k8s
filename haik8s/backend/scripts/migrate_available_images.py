"""
Migration script: Add available_images field to application_definitions table

Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
"""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import init_db
import db.database as db_module
from db.models import ApplicationDefinition
from sqlmodel import Session, select
from sqlalchemy import text


def migrate_available_images():
    """Add available_images column and set default values for existing applications"""
    init_db()

    engine = db_module.engine

    # Add column if not exists (SQLite does not support IF NOT EXISTS for ADD COLUMN)
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE application_definitions ADD COLUMN available_images TEXT"))
            conn.commit()
            print("  Added column: application_definitions.available_images")
        except Exception as e:
            if "duplicate column" in str(e).lower():
                print("  Column already exists, skipping ALTER TABLE")
            else:
                raise

    with Session(engine) as session:
        apps = session.exec(select(ApplicationDefinition)).all()

        for app in apps:
            if app.available_images is not None:
                print(f"  Skipping {app.app_id}: available_images already set")
                continue

            default_image = {
                "tag": app.version,
                "registry_url": f"{app.image_prefix}:{app.version}",
                "description": "默认版本",
                "is_default": True,
            }
            app.available_images = json.dumps([default_image])
            session.add(app)
            print(f"  Set default available_images for {app.app_id}: {app.image_prefix}:{app.version}")

        session.commit()
        print(f"\n✓ Migration completed: Updated {len(apps)} application definitions")


if __name__ == "__main__":
    print("Starting available_images migration...")
    migrate_available_images()
