# Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
# K8s Pod 状态 TTL 内存缓存，减少高频轮询时的 K8s API 调用次数。
# TTL=5s 适合 4s 前端轮询间隔，相同 Pod 在同一轮询周期内只查询一次。

from typing import Optional
from threading import Lock
from cachetools import TTLCache

from k8s_service.pods import get_pod_status

_pod_status_cache: TTLCache = TTLCache(maxsize=500, ttl=5)
_cache_lock = Lock()


def get_pod_status_cached(namespace: str, pod_name: str) -> Optional[str]:
    """Get pod phase with a 5-second TTL cache to reduce K8s API calls.

    Falls back to a direct K8s API call on cache miss, then stores the result.
    Thread-safe; safe for FastAPI single-process deployments.
    For multi-process (gunicorn), use a Redis-backed cache instead.
    """
    key = f"{namespace}/{pod_name}"
    with _cache_lock:
        if key in _pod_status_cache:
            return _pod_status_cache[key]
    status = get_pod_status(namespace, pod_name)
    with _cache_lock:
        _pod_status_cache[key] = status
    return status
