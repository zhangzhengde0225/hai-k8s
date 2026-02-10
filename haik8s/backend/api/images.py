"""
Image API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from db.database import get_session
from db.models import User, UserRole
from db.crud import create_image, list_images, delete_image, get_image_by_id
from auth.dependencies import get_current_user, require_role
from schemas.image import CreateImageRequest, ImageResponse


router = APIRouter(prefix="/api/images", tags=["images"])


@router.get("", response_model=list[ImageResponse])
async def list_available_images(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """List active images"""
    images = list_images(session, active_only=True)
    return [ImageResponse.model_validate(img) for img in images]


@router.post("", response_model=ImageResponse, status_code=status.HTTP_201_CREATED)
async def create_image_endpoint(
    req: CreateImageRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    session: Session = Depends(get_session),
):
    """Create a new image (admin only)"""
    image = create_image(
        session,
        name=req.name,
        registry_url=req.registry_url,
        description=req.description,
        default_cmd=req.default_cmd,
        gpu_required=req.gpu_required,
    )
    return ImageResponse.model_validate(image)


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
