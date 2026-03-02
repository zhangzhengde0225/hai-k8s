"""
IP Allocation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime

from db.database import get_session
from db.models import User, IPAllocation
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/ip-allocations", tags=["IP Allocations"])

# IP地址范围配置
IP_RANGE_START = "10.5.6.200"
IP_RANGE_END = "10.5.6.254"
IP_PREFIX = "10.5.6."
IP_START = 200
IP_END = 254


def get_next_available_ip(session: Session) -> str:
    """获取下一个可用的IP地址"""
    # 获取所有已分配的活跃IP
    allocated_ips = session.exec(
        select(IPAllocation).where(IPAllocation.is_active == True)
    ).all()

    allocated_ip_set = {ip.ip_address for ip in allocated_ips}

    # 遍历IP范围，找到第一个未分配的IP
    for i in range(IP_START, IP_END + 1):
        ip = f"{IP_PREFIX}{i}"
        if ip not in allocated_ip_set:
            return ip

    # 如果所有IP都已分配
    raise HTTPException(status_code=400, detail="IP地址池已耗尽，无可用IP")


@router.get("/my-ip")
async def get_my_ip(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """获取当前用户的IP分配"""
    ip_allocation = session.exec(
        select(IPAllocation).where(
            IPAllocation.user_id == current_user.id,
            IPAllocation.is_active == True
        )
    ).first()

    if not ip_allocation:
        return {
            "has_ip": False,
            "ip_address": None,
            "allocated_at": None,
        }

    return {
        "has_ip": True,
        "ip_address": ip_allocation.ip_address,
        "allocated_at": ip_allocation.allocated_at.isoformat() if ip_allocation.allocated_at else None,
        "notes": ip_allocation.notes,
    }


@router.post("/allocate", status_code=201)
async def allocate_ip(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """为当前用户分配IP地址"""
    # 检查用户是否已有活跃IP
    existing_ip = session.exec(
        select(IPAllocation).where(
            IPAllocation.user_id == current_user.id,
            IPAllocation.is_active == True
        )
    ).first()

    if existing_ip:
        raise HTTPException(status_code=400, detail=f"用户已有IP地址: {existing_ip.ip_address}")

    # 获取下一个可用IP
    ip_address = get_next_available_ip(session)

    # 检查是否存在历史释放记录（unique constraint 限制只能有一行）
    existing_released = session.exec(
        select(IPAllocation).where(
            IPAllocation.user_id == current_user.id,
            IPAllocation.is_active == False
        )
    ).first()

    if existing_released:
        # 复用已有行，重新激活
        existing_released.ip_address = ip_address
        existing_released.is_active = True
        existing_released.allocated_at = datetime.utcnow()
        existing_released.released_at = None
        session.add(existing_released)
        session.commit()
        session.refresh(existing_released)
        return {
            "message": "IP地址分配成功",
            "ip_address": existing_released.ip_address,
            "allocated_at": existing_released.allocated_at.isoformat(),
        }

    # 首次分配：创建新记录
    ip_allocation = IPAllocation(
        user_id=current_user.id,
        ip_address=ip_address,
        is_active=True,
        allocated_at=datetime.utcnow(),
    )

    session.add(ip_allocation)
    session.commit()
    session.refresh(ip_allocation)

    return {
        "message": "IP地址分配成功",
        "ip_address": ip_allocation.ip_address,
        "allocated_at": ip_allocation.allocated_at.isoformat() if ip_allocation.allocated_at else None,
    }


@router.delete("/release")
async def release_ip(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """释放当前用户的IP地址"""
    ip_allocation = session.exec(
        select(IPAllocation).where(
            IPAllocation.user_id == current_user.id,
            IPAllocation.is_active == True
        )
    ).first()

    if not ip_allocation:
        raise HTTPException(status_code=404, detail="用户没有已分配的IP")

    # 标记为已释放
    ip_allocation.is_active = False
    ip_allocation.released_at = datetime.utcnow()

    session.add(ip_allocation)
    session.commit()

    return {
        "message": "IP地址已释放",
        "ip_address": ip_allocation.ip_address,
    }


@router.get("/available-count")
async def get_available_ip_count(
    session: Session = Depends(get_session),
):
    """获取可用IP数量"""
    allocated_count = session.exec(
        select(IPAllocation).where(IPAllocation.is_active == True)
    ).all()

    total_ips = IP_END - IP_START + 1
    allocated = len(allocated_count)
    available = total_ips - allocated

    return {
        "total": total_ips,
        "allocated": allocated,
        "available": available,
    }
