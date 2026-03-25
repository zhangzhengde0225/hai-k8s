

cluster_username = "huy"
import pwd
pw = pwd.getpwnam(cluster_username)
cluster_uid = pw.pw_uid
cluster_gid =  pw.pw_gid

print(f"cluster_username: {cluster_username}")
print(f"cluster_uid: {cluster_uid}")
print(f"cluster_gid: {cluster_gid}")