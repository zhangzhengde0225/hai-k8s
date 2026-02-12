"""
Seed default images into the database
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.database import init_db, engine
from db.models import Image
from sqlmodel import Session, select


DEFAULT_IMAGES = [
    # Application Images
    {
        "name": "hai-openclaw",
        "registry_url": "registry.example.com/hai-openclaw:latest",  # 请替换为实际的镜像地址
        "description": "OpenClaw AI Assistant Application",
        "default_cmd": "/bin/bash",
        "gpu_required": False,
    },
    {
        "name": "hai-opendrsai",
        "registry_url": "registry.example.com/hai-opendrsai:latest",  # 请替换为实际的镜像地址
        "description": "OpenDrSai AI Research Assistant",
        "default_cmd": "/bin/bash",
        "gpu_required": True,
    },
    # System Images
    {
        "name": "Ubuntu 22.04",
        "registry_url": "ubuntu:22.04",
        "description": "Ubuntu 22.04 LTS base image",
        "default_cmd": "/bin/bash",
        "gpu_required": False,
    },
    {
        "name": "Python 3.11",
        "registry_url": "python:3.11",
        "description": "Python 3.11 with pip",
        "default_cmd": "/bin/bash",
        "gpu_required": False,
    },
    {
        "name": "CUDA 12.2 Ubuntu 22.04",
        "registry_url": "nvidia/cuda:12.2.0-runtime-ubuntu22.04",
        "description": "NVIDIA CUDA 12.2 runtime on Ubuntu 22.04",
        "default_cmd": "/bin/bash",
        "gpu_required": True,
    },
]


def seed_images():
    init_db()
    with Session(engine) as session:
        for img_data in DEFAULT_IMAGES:
            existing = session.exec(
                select(Image).where(Image.name == img_data["name"])
            ).first()
            if not existing:
                image = Image(**img_data)
                session.add(image)
                print(f"  Added: {img_data['name']}")
            else:
                print(f"  Exists: {img_data['name']}")
        session.commit()
    print("Done.")


if __name__ == "__main__":
    seed_images()
