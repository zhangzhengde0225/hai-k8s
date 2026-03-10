# MetalLB Integration - Verification Checklist

## Pre-requisites
- [ ] MetalLB is installed in the Kubernetes cluster
- [ ] MetalLB IP address pool is configured
- [ ] K8s cluster has at least one node accessible
- [ ] User `zdzhang@ihep.ac.cn` exists in the database
- [ ] Image `hai-openclaw` exists and is active in the database
- [ ] Container image has `openssh-server` installed

## Implementation Verification

### 1. Code Structure
- [x] `inject_ssh_loadbalancer.py` created with 3 main functions
- [x] `inject_user.py` modified to start sshd daemon
- [x] `launch_openclaw.py` NodePort logic removed
- [x] `launch_openclaw.py` LoadBalancer creation added
- [x] All Python files compile without syntax errors

### 2. Key Functions Implemented
- [x] `create_ssh_loadbalancer_service()` - Creates LoadBalancer Service
- [x] `get_loadbalancer_ip()` - Retrieves allocated IP with timeout
- [x] `delete_ssh_loadbalancer_service()` - Cleanup function

### 3. inject_user.py Changes
- [x] SSH daemon startup logic implemented
- [x] Host key generation added
- [x] `/var/run/sshd` directory creation
- [x] Foreground mode with verbose logging (`sshd -D -e`)
- [x] Fallback to `tail -f /dev/null` if sshd not found

### 4. launch_openclaw.py Changes
- [x] NodePort allocation removed (lines 357-367 deleted)
- [x] `ssh_node_port=None` in database record
- [x] LoadBalancer service creation after pod creation
- [x] IP allocation wait with 60-second timeout
- [x] Updated output to show LoadBalancer IP
- [x] kubectl command provided if IP allocation pending

## Testing Steps

### Step 1: Launch Container
```bash
cd /aifs/user/home/zdzhang/VSProjects/hai-k8s/haik8s/backend/k8s/tests
python launch_openclaw.py --username zdzhang@ihep.ac.cn --custom-uid 21927 --custom-gid 600
```

**Expected Output:**
- [ ] Pod creation successful
- [ ] LoadBalancer service created
- [ ] IP allocation message appears
- [ ] Either "LoadBalancer IP allocated: X.X.X.X" or warning with kubectl command
- [ ] SSH command displayed: `ssh zdzhang@<IP>`

### Step 2: Verify Kubernetes Resources
```bash
# Check pod status
kubectl get pods -n haik8s-zdzhang

# Check service and external IP
kubectl get svc -n haik8s-zdzhang

# Check service details
kubectl describe svc -n haik8s-zdzhang <service-name>
```

**Expected Results:**
- [ ] Pod status is Running
- [ ] Service type is LoadBalancer
- [ ] EXTERNAL-IP is assigned (not <pending>)
- [ ] Service ports show 22:XXXXX/TCP

### Step 3: Check Pod Logs
```bash
kubectl logs -n haik8s-zdzhang <pod-name>
```

**Expected Log Contents:**
- [ ] "=== HAI-K8S User Injection Script ==="
- [ ] User and group creation messages
- [ ] "[6/6] Verifying user setup..."
- [ ] "=== User injection completed successfully ==="
- [ ] "Starting SSH daemon..."
- [ ] "Generating SSH host keys..." (if first time)
- [ ] "Starting sshd in foreground mode..."
- [ ] No error messages from sshd

### Step 4: Set Password and Test SSH
```bash
# Set password for user
kubectl exec -it -n haik8s-zdzhang <pod-name> -- passwd zdzhang

# Test SSH connection
ssh zdzhang@<EXTERNAL-IP>
```

**Expected Results:**
- [ ] Password set successfully
- [ ] SSH connection establishes
- [ ] User is `zdzhang` with UID 21927 and GID 600
- [ ] Home directory is `/home/zdzhang`
- [ ] User has sudo privileges (if enabled)
- [ ] Custom .bashrc is loaded

### Step 5: Verify User Environment
```bash
# Inside the SSH session:
id
pwd
sudo -l
ls -la ~
```

**Expected Results:**
- [ ] UID=21927, GID=600
- [ ] Current directory is `/home/zdzhang`
- [ ] Sudo shows `NOPASSWD: ALL` (if sudo enabled)
- [ ] Home directory is owned by zdzhang:600

## Troubleshooting

### LoadBalancer IP Not Allocated
**Symptoms:** EXTERNAL-IP shows `<pending>`

**Checks:**
1. Verify MetalLB is running:
   ```bash
   kubectl get pods -n metallb-system
   ```
2. Check MetalLB configuration:
   ```bash
   kubectl get ipaddresspool -n metallb-system
   kubectl get l2advertisement -n metallb-system
   ```
3. Check MetalLB logs:
   ```bash
   kubectl logs -n metallb-system -l app=metallb
   ```

### SSH Connection Refused
**Symptoms:** `Connection refused` when trying to SSH

**Checks:**
1. Verify sshd is running in pod:
   ```bash
   kubectl exec -n haik8s-zdzhang <pod-name> -- ps aux | grep sshd
   ```
2. Check if port 22 is listening:
   ```bash
   kubectl exec -n haik8s-zdzhang <pod-name> -- netstat -tlnp | grep 22
   ```
3. Check pod logs for sshd errors:
   ```bash
   kubectl logs -n haik8s-zdzhang <pod-name> | grep -i ssh
   ```

### SSH Authentication Failed
**Symptoms:** Password not accepted

**Checks:**
1. Verify user exists:
   ```bash
   kubectl exec -n haik8s-zdzhang <pod-name> -- id zdzhang
   ```
2. Check SSH configuration:
   ```bash
   kubectl exec -n haik8s-zdzhang <pod-name> -- cat /etc/ssh/sshd_config | grep PasswordAuthentication
   ```
3. Reset password:
   ```bash
   kubectl exec -it -n haik8s-zdzhang <pod-name> -- passwd zdzhang
   ```

### sshd Not Starting
**Symptoms:** Pod logs show "sshd not found"

**Checks:**
1. Check if openssh-server is installed:
   ```bash
   kubectl exec -n haik8s-zdzhang <pod-name> -- which sshd
   ```
2. Manually install if needed:
   ```bash
   kubectl exec -it -n haik8s-zdzhang <pod-name> -- bash
   # apt-get update && apt-get install -y openssh-server
   ```

## Cleanup

```bash
# Delete the pod
kubectl delete pod -n haik8s-zdzhang <pod-name>

# Delete the service
kubectl delete svc -n haik8s-zdzhang <service-name>

# Or delete everything in the namespace
kubectl delete all --all -n haik8s-zdzhang
```

## Success Criteria

All of the following should be true:
- [x] Code implementation complete and compiles
- [ ] Container launches successfully with LoadBalancer service
- [ ] MetalLB assigns external IP within 60 seconds
- [ ] SSH daemon starts in pod
- [ ] SSH connection works from external host
- [ ] User has correct UID/GID and permissions
- [ ] Volume mounts are accessible

## Notes
- The first container launch may take longer due to image pulling
- MetalLB IP allocation typically takes 5-15 seconds
- Password must be set manually after container creation
- sshd runs in foreground mode to keep container alive
