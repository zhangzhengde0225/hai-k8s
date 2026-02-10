from kubernetes import client, config
from pathlib import Path
HERE = Path(__file__).parent

# 注：这个配置文件需要从K8S集群中获取，通常位于~/.kube/config，并保存到本仓库的.kube/config中
config.load_kube_config(config_file=f'{HERE.parent}/.kube/config')

v1 = client.CoreV1Api()
print("Listing pods with their IPs:")
ret = v1.list_pod_for_all_namespaces(watch=False)
for i in ret.items:
    print("%s\t%s\t%s" % (i.status.pod_ip, i.metadata.namespace, i.metadata.name))