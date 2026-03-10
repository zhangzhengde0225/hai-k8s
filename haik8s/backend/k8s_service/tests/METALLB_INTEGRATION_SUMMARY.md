# MetalLB Integration Implementation Summary

## Overview
Successfully integrated MetalLB LoadBalancer network configuration into `launch_openclaw.py` to enable automatic external IP allocation for SSH access.

## Changes Made

### 1. New File Created: `inject_ssh_loadbalancer.py`
**Location**: `haik8s/backend/k8s/tests/inject_ssh_loadbalancer.py`

**Functions**:
- `create_ssh_loadbalancer_service()`: Creates a LoadBalancer-type Service for SSH access
- `get_loadbalancer_ip()`: Waits for and retrieves the MetalLB-assigned external IP
- `delete_ssh_loadbalancer_service()`: Deletes a LoadBalancer service

**Key Features**:
- Automatic IP allocation via MetalLB
- Configurable timeout for IP allocation (default: 60 seconds)
- Proper label management for K8s resource tracking
- Error handling and graceful degradation

### 2. Modified: `inject_user.py`
**Location**: `haik8s/backend/k8s/tests/inject_user.py`

**Changes** (lines 269-297):
- Changed container keep-alive logic from `tail -f /dev/null` to starting `sshd -D -e`
- Added SSH host key generation if not present
- Ensures `/var/run/sshd` directory exists
- Starts SSH daemon in foreground mode with verbose logging
- Graceful fallback to `tail -f /dev/null` if sshd is not available

### 3. Modified: `launch_openclaw.py`
**Location**: `haik8s/backend/k8s/tests/launch_openclaw.py`

#### A. Removed NodePort Allocation (lines 357-367)
- Deleted entire NodePort allocation logic
- No longer calls `find_available_nodeport_enhanced()`
- Simplifies port management by relying on MetalLB

#### B. Updated Database Record Creation (line 394)
```python
ssh_node_port=None,  # LoadBalancer doesn't use NodePort
```

#### C. New LoadBalancer Service Creation (lines 427-453)
- Imports `create_ssh_loadbalancer_service` and `get_loadbalancer_ip`
- Creates LoadBalancer Service after pod creation
- Waits up to 60 seconds for IP allocation
- Provides helpful messages if IP allocation is pending

#### D. Updated Output Information (lines 464-475)
- Displays allocated LoadBalancer IP when available
- Shows SSH command using LoadBalancer IP: `ssh user@<IP>`
- Provides kubectl command to check service status if IP is pending

## Benefits

1. **Simplified Port Management**: No manual NodePort allocation needed
2. **Automatic IP Assignment**: MetalLB handles IP allocation automatically
3. **Direct SSH Access**: Users can SSH directly to the assigned IP without port forwarding
4. **Better Security**: No need to expose NodePort ranges
5. **Cleaner Architecture**: Separation of concerns with dedicated network module

## Testing

### 1. Launch a Container
```bash
cd haik8s/backend/k8s/tests
python launch_openclaw.py --username zdzhang@ihep.ac.cn --custom-uid 21927 --custom-gid 600
```

### 2. Check Service and IP
```bash
kubectl get svc -n haik8s-zdzhang
# Should show LoadBalancer type with EXTERNAL-IP
```

### 3. Test SSH Connection
```bash
ssh zdzhang@<EXTERNAL-IP>
# Use the LoadBalancer IP from step 2
```

### 4. Check Pod Logs
```bash
kubectl logs -n haik8s-zdzhang <pod-name>
# Should show:
# - User injection completed
# - SSH host keys generated
# - sshd started in foreground mode
```

## MetalLB Requirements

Ensure your Kubernetes cluster has:
1. MetalLB installed and configured
2. IP address pool configured (e.g., `192.168.1.240-192.168.1.250`)
3. Layer 2 or BGP mode configured properly

Example MetalLB configuration:
```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: default-pool
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.240-192.168.1.250
---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: default
  namespace: metallb-system
spec:
  ipAddressPools:
  - default-pool
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  launch_openclaw.py                                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1. Create Pod (inject_user.py)                    │ │
│  │     - Custom user with UID/GID                     │ │
│  │     - Start sshd daemon                            │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  2. Create LoadBalancer Service                    │ │
│  │     (inject_ssh_loadbalancer.py)                   │ │
│  │     - Service type: LoadBalancer                   │ │
│  │     - Port: 22 -> 22                               │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  3. Wait for IP Allocation                         │ │
│  │     - MetalLB assigns external IP                  │ │
│  │     - Timeout: 60 seconds                          │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  4. Display SSH Access Info                        │ │
│  │     ssh user@<LoadBalancer-IP>                     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │   MetalLB Controller  │
              │   - Allocates IP      │
              │   - Updates Service   │
              └──────────────────────┘
                          │
                          ▼
              ┌──────────────────────┐
              │   External Access     │
              │   ssh user@IP         │
              └──────────────────────┘
```

## File Structure

```
haik8s/backend/k8s/tests/
├── inject_ssh_loadbalancer.py    # NEW: LoadBalancer service management
├── inject_user.py                 # MODIFIED: SSH daemon startup
├── launch_openclaw.py             # MODIFIED: Integration logic
└── METALLB_INTEGRATION_SUMMARY.md # This file
```

## Notes

1. **Password Setup**: Users still need to set their password manually:
   ```bash
   kubectl exec -it -n <namespace> <pod-name> -- passwd <username>
   ```

2. **Database**: `ssh_node_port` is set to `None` since we're using LoadBalancer
   - Can be extended later to store LoadBalancer IP if needed

3. **Fallback**: If MetalLB IP allocation fails, the script provides kubectl commands to check status

4. **Image Requirements**: Container image must have `openssh-server` installed
   - If not available, sshd won't start but container will remain running

## Future Enhancements

1. Store LoadBalancer IP in database for tracking
2. Add support for custom SSH ports
3. Implement SSH key injection during user creation
4. Add health checks for SSH service
5. Support multiple LoadBalancer pools based on user requirements

## References

- MetalLB Documentation: https://metallb.universe.tf/
- Reference Implementation: `haik8s/backend/k8s/tests/network_demo/ssh-test.yaml`
- User Injection Module: `haik8s/backend/k8s/tests/inject_user.py`
