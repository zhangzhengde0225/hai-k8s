"""POD management request/response models"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class ContainerInfo(BaseModel):
    """Container information"""
    name: str
    image: str
    ready: bool
    restart_count: int


class ResourceInfo(BaseModel):
    """Resource information"""
    cpu: Optional[str] = None
    memory: Optional[str] = None
    gpu: Optional[str] = None


class OwnerReference(BaseModel):
    """Parent resource reference"""
    kind: str
    name: str


class PodListResponse(BaseModel):
    """POD list response"""
    namespace: str
    name: str
    phase: str  # Running, Pending, Failed, Succeeded, Unknown
    pod_ip: Optional[str] = None
    node_name: Optional[str] = None
    created_at: datetime
    containers: List[ContainerInfo]
    labels: Dict[str, str]
    is_system_managed: bool  # Whether managed by HAI-K8S
    container_id: Optional[int] = None  # Associated database container ID (if any)
    resource_requests: ResourceInfo
    resource_limits: ResourceInfo
    owner_references: List[OwnerReference]


class PodCondition(BaseModel):
    """POD status condition"""
    type: str
    status: str
    reason: Optional[str] = None
    message: Optional[str] = None
    last_transition_time: Optional[str] = None


class VolumeInfo(BaseModel):
    """Volume information"""
    name: str
    type: str
    source: Optional[str] = None


class PodDetailResponse(BaseModel):
    """POD detail response"""
    namespace: str
    name: str
    labels: Dict[str, str]
    annotations: Dict[str, str]
    phase: str
    pod_ip: Optional[str] = None
    host_ip: Optional[str] = None
    node_name: Optional[str] = None
    created_at: Optional[str] = None
    conditions: List[PodCondition]
    volumes: List[VolumeInfo]
    restart_policy: Optional[str] = None
    service_account: Optional[str] = None


class PodLogsResponse(BaseModel):
    """POD logs response"""
    logs: str


class PodEventResponse(BaseModel):
    """POD events response"""
    events: List[Dict[str, Any]]
