"""
Kubernetes client initialization for HAI-K8S
"""
from kubernetes import client, config as k8s_config
from kubernetes.client import CoreV1Api, AppsV1Api
from kubernetes.client.rest import ApiException
from pathlib import Path

_core_v1: CoreV1Api = None
_apps_v1: AppsV1Api = None


def init_k8s_client(kubeconfig_path: str):
    """Load kubeconfig and initialize K8s API singletons"""
    global _core_v1, _apps_v1
    try:
        k8s_config.load_kube_config(config_file=kubeconfig_path)
    except Exception as e:
        try:
            HOME = str(Path.home())
            kubeconfig_path = f"{HOME}/.kube/config"
            k8s_config.load_kube_config(config_file=kubeconfig_path)
            print(f"Loaded kubeconfig from {kubeconfig_path}")
        except Exception as e2:
            raise RuntimeError(f"Failed to load kubeconfig from both {kubeconfig_path} and {HOME}/.kube/config") from e2

    # k8s_config.load_kube_config(config_file=kubeconfig_path)
    _core_v1 = CoreV1Api()
    _apps_v1 = AppsV1Api()


def get_core_v1() -> CoreV1Api:
    if _core_v1 is None:
        raise RuntimeError("K8s client not initialized. Call init_k8s_client() first.")
    return _core_v1


def get_apps_v1() -> AppsV1Api:
    if _apps_v1 is None:
        raise RuntimeError("K8s client not initialized. Call init_k8s_client() first.")
    return _apps_v1


def ensure_namespace(name: str):
    """Create namespace if it doesn't exist"""
    v1 = get_core_v1()
    try:
        v1.read_namespace(name)
    except ApiException as e:
        if e.status == 404:
            ns = client.V1Namespace(
                metadata=client.V1ObjectMeta(
                    name=name,
                    labels={"app": "haik8s", "managed-by": "haik8s"},
                )
            )
            v1.create_namespace(ns)
        else:
            raise
