"""
Image API endpoints
"""
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from db.database import get_session
from db.models import User, UserRole, Image
from db.crud import list_images, delete_image
from auth.dependencies import get_current_user, require_role
from schemas.image import CreateImageRequest, ImageUpdateRequest, ImageResponse


router = APIRouter(prefix="/api/images", tags=["Images"])


def _image_to_response(image: Image) -> ImageResponse:
    """Convert Image model to response model (handling JSON field parsing)"""
    return ImageResponse(
        id=image.id,
        name=image.name,
        registry_url=image.registry_url,
        description=image.description,
        default_cmd=image.default_cmd,
        gpu_required=image.gpu_required,
        is_active=image.is_active,
        created_at=image.created_at,
        updated_at=image.updated_at,
        version=image.version,
        tags=json.loads(image.tags) if image.tags else None,
        env_vars=json.loads(image.env_vars) if image.env_vars else None,
        ports=json.loads(image.ports) if image.ports else None,
        recommended_resources=json.loads(image.recommended_resources) if image.recommended_resources else None,
    )


@router.get("", response_model=list[ImageResponse])
async def list_available_images(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List images. Admins can include inactive images."""
    images = list_images(session, active_only=not include_inactive)
    return [_image_to_response(img) for img in images]


@router.post("", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def create_image_endpoint(
    req: CreateImageRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Create a new image (admin only)"""
    # Check if image name+version already exists
    existing = session.exec(
        select(Image).where(Image.name == req.name, Image.version == req.version)
    ).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Image name already exists")
        # Reactivate existing image
        existing.is_active = True
        existing.registry_url = req.registry_url
        existing.description = req.description
        existing.default_cmd = req.default_cmd
        existing.gpu_required = req.gpu_required
        existing.version = req.version
        existing.tags = json.dumps(req.tags) if req.tags else None
        existing.env_vars = json.dumps(req.env_vars) if req.env_vars else None
        existing.ports = json.dumps(req.ports) if req.ports else None
        existing.recommended_resources = json.dumps(req.recommended_resources) if req.recommended_resources else None
        existing.updated_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return _image_to_response(existing)

    # Create new image
    image = Image(
        name=req.name,
        registry_url=req.registry_url,
        description=req.description,
        default_cmd=req.default_cmd,
        gpu_required=req.gpu_required,
        version=req.version,
        tags=json.dumps(req.tags) if req.tags else None,
        env_vars=json.dumps(req.env_vars) if req.env_vars else None,
        ports=json.dumps(req.ports) if req.ports else None,
        recommended_resources=json.dumps(req.recommended_resources) if req.recommended_resources else None,
    )
    session.add(image)
    session.commit()
    session.refresh(image)
    return _image_to_response(image)


@router.put("/{image_id}", response_model=ImageResponse)
async def update_image(
    image_id: int,
    req: ImageUpdateRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Update an image (admin only)"""
    # Get image
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    # Check name+version uniqueness if changing name or version
    check_name = req.name if req.name is not None else image.name
    check_version = req.version if req.version is not None else image.version
    if check_name != image.name or check_version != image.version:
        existing = session.exec(
            select(Image).where(Image.name == check_name, Image.version == check_version)
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Image name already exists")

    # Update fields (only update provided fields)
    if req.name is not None:
        image.name = req.name
    if req.registry_url is not None:
        image.registry_url = req.registry_url
    if req.description is not None:
        image.description = req.description
    if req.default_cmd is not None:
        image.default_cmd = req.default_cmd
    if req.gpu_required is not None:
        image.gpu_required = req.gpu_required
    if req.version is not None:
        image.version = req.version

    # Handle JSON fields
    if req.tags is not None:
        image.tags = json.dumps(req.tags) if req.tags else None
    if req.env_vars is not None:
        image.env_vars = json.dumps(req.env_vars) if req.env_vars else None
    if req.ports is not None:
        image.ports = json.dumps(req.ports) if req.ports else None
    if req.recommended_resources is not None:
        image.recommended_resources = json.dumps(req.recommended_resources) if req.recommended_resources else None

    image.updated_at = datetime.utcnow()

    # Save and return
    session.add(image)
    session.commit()
    session.refresh(image)

    return _image_to_response(image)


@router.delete("/{image_id}")
async def delete_image_endpoint(
    image_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Deactivate an image (admin only)"""
    if not delete_image(session, image_id):
        raise HTTPException(status_code=404, detail="Image not found")
    return {"message": "Image deactivated"}


@router.patch("/{image_id}/toggle")
async def toggle_image_status(
    image_id: int,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Toggle image active status (admin only)"""
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    image.is_active = not image.is_active
    image.updated_at = datetime.utcnow()
    session.add(image)
    session.commit()
    session.refresh(image)

    status = "activated" if image.is_active else "deactivated"
    return {"message": f"Image {status}", "is_active": image.is_active}
