"""
IP Allocation API endpoints
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime

from db.database import get_session
from db.models import User, IPAllocation, Container, ApplicationConfig, ContainerStatus
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/ip-allocations", tags=["IP Allocations"])

# IP地址范围配置
IP_RANGE_START = "10.5.8.11"
IP_RANGE_END = "10.5.8.254"
IP_PREFIX = "10.5.8."
IP_START = 15
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

    # 检查是否存在历史释放记录（unique constraint 限制只能有一行）
    existing_released = session.exec(
        select(IPAllocation).where(
            IPAllocation.user_id == current_user.id,
            IPAllocation.is_active == False
        )
    ).first()

    # 获取下一个可用IP（排除当前用户已有的历史记录）
    ip_address = get_next_available_ip(session)

    if existing_released:
        # 复用已释放的记录，分配新的IP
        # 因为释放时IP已被清空（改为released_xxx格式），所以直接分配新IP

        # 检查新IP是否被占用（并发安全检查）
        conflicting_ip = session.exec(
            select(IPAllocation).where(
                IPAllocation.ip_address == ip_address,
                IPAllocation.id != existing_released.id
            )
        ).first()

        if conflicting_ip:
            # 如果发生并发冲突，重新获取一个IP
            session.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"IP地址 {ip_address} 已被其他用户占用，请重试"
            )

        # 更新IP地址并重新激活
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

    try:
        session.add(ip_allocation)
        session.commit()
        session.refresh(ip_allocation)
    except Exception as e:
        session.rollback()
        # 检查是否为IP地址冲突
        if "ip_address" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(
                status_code=409,
                detail=f"IP地址 {ip_address} 已被其他用户占用，请重试"
            )
        # 其他类型的错误
        raise HTTPException(status_code=500, detail=f"分配IP失败: {str(e)}")

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

    # 保存IP地址用于返回
    released_ip = ip_allocation.ip_address

    # 检查是否有正在运行或创建中的容器使用该IP
    running_containers = session.exec(
        select(Container).where(
            Container.user_id == current_user.id,
            Container.status.in_([ContainerStatus.CREATING, ContainerStatus.RUNNING])
        )
    ).all()

    # 查找使用该IP的正在运行的容器
    active_instances = []
    for container in running_containers:
        if container.config_id:
            config = session.get(ApplicationConfig, container.config_id)
            if config and config.bound_ip == released_ip:
                active_instances.append({
                    'container_name': container.name,
                    'app_id': config.application_id
                })

    # 如果有正在运行的容器使用该IP，禁止释放
    if active_instances:
        instances_info = ', '.join(
            f"{inst['container_name']}({inst['app_id']})" for inst in active_instances
        )
        raise HTTPException(
            status_code=400,
            detail=f"无法释放IP地址：该IP正在被以下实例使用：{instances_info}。请先停止相关实例后再释放IP。"
        )

    # 标记为已释放，并清空IP地址以释放unique约束
    # 这样其他用户可以重新使用这个IP
    ip_allocation.is_active = False
    ip_allocation.released_at = datetime.utcnow()
    ip_allocation.ip_address = f"released_{current_user.id}_{datetime.utcnow().timestamp()}"  # 释放unique约束

    session.add(ip_allocation)
    session.commit()

    return {
        "message": "IP地址已释放",
        "ip_address": released_ip,
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
