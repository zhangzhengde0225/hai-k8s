#!/usr/bin/env python3
"""
Test container isolation: malicious Skill attack simulation.

This script deploys a "malicious Skill" inside an agent container and
tests whether it can perform lateral movement attacks.

NOTE: Only run this in a controlled test environment with authorization.

Usage:
    python3 test_isolation.py <container_id> --admin-key KEY --user-jwt TOKEN

Author: Zhengde ZHANG
Date: 2026-03-28
"""
import argparse
import json
import urllib.request
import urllib.error


def exec_in_container(container_id, command, admin_key, user_jwt, base_url="http://localhost:42900", timeout=30):
    url = f"{base_url}/api/skills/containers/{container_id}/exec"
    payload = {"command": command, "timeout": timeout}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={
            "Content-Type": "application/json",
            "X-Admin-API-Key": admin_key,
            "Authorization": f"Bearer {user_jwt}",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout + 10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        try:
            detail = json.loads(body).get("detail", body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            detail = body or str(e)
        return {"success": False, "output": "", "error": f"HTTP {e.code}: {detail}", "exit_code": -1}
    except urllib.error.URLError as e:
        return {"success": False, "output": "", "error": f"Connection error: {e.reason}", "exit_code": -1}


def test_cross_user_data_access(container_id, admin_key, user_jwt, base_url):
    """Test if container can access other users' data."""
    print("\n[Test A] Cross-User Data Access")
    print("  Attempting to read /var/run/secrets/kubernetes.io/serviceaccount (other namespace)...")
    
    cmd = "cat /var/run/secrets/kubernetes.io/serviceaccount/namespace 2>&1 || echo 'ACCESS_DENIED'"
    result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=10)
    
    output = result.get("output", "").strip()
    if "ACCESS_DENIED" in output or "Permission denied" in output or result.get("exit_code") != 0:
        print(f"  Result: BLOCKED ✅")
        return {"test": "cross_user_access", "blocked": True, "output": output}
    else:
        print(f"  Result: LEAKED ❌ (namespace: {output})")
        return {"test": "cross_user_access", "blocked": False, "output": output}


def test_host_key_exfiltration(container_id, admin_key, user_jwt, base_url):
    """Test if container can read host SSH keys."""
    print("\n[Test B] Host Key Exfiltration")
    print("  Attempting to read host SSH keys and kubeconfig...")
    
    paths_to_check = [
        "/host/etc/ssh/ssh_host_rsa_key",
        "/host/root/.ssh/id_rsa",
        "/host/etc/kubernetes/admin.conf",
        "/etc/kubernetes/admin.conf",
        "/var/run/secrets/kubernetes.io/serviceaccount/token",
    ]
    
    results = []
    for path in paths_to_check:
        cmd = f"cat {path} 2>&1 | head -1 || echo 'NOT_ACCESSIBLE'"
        result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=10)
        output = result.get("output", "").strip()
        if "NOT_ACCESSIBLE" in output or "Permission denied" in output or result.get("exit_code") != 0:
            results.append((path, "BLOCKED"))
        else:
            results.append((path, "LEAKED"))
    
    all_blocked = all(r[1] == "BLOCKED" for r in results)
    for path, status in results:
        print(f"  {path}: {status} {'✅' if status == 'BLOCKED' else '❌'}")
    
    return {"test": "host_key_exfil", "blocked": all_blocked, "details": dict(results)}


def test_container_escape(container_id, admin_key, user_jwt, base_url):
    """Test if container can escape to host."""
    print("\n[Test C] Container Escape Attempts")
    
    escape_attempts = [
        ("mount --bind /host /host", "Bind mount host filesystem"),
        ("nsenter --target 1 --mount -- ls /", "nsenter to host namespace"),
        ("cat /proc/1/mounts | grep /host", "Check host mount exposure"),
        ("sysctl -w kernel.shmmax=999999999", "Modify host kernel param"),
        ("fdisk -l /dev/sda 2>&1 | head -3", "Read host disk directly"),
    ]
    
    results = []
    for cmd, description in escape_attempts:
        result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=10)
        output = result.get("output", "").strip()
        if result.get("exit_code") == 0 and "Permission denied" not in output and "cannot" not in output.lower():
            results.append((description, "ESCAPED"))
            print(f"  {description}: ESCAPED ❌")
        else:
            results.append((description, "BLOCKED"))
            print(f"  {description}: BLOCKED ✅")
    
    all_blocked = all(r[1] == "BLOCKED" for r in results)
    return {"test": "container_escape", "blocked": all_blocked, "details": dict(results)}


def test_cross_container_network(container_id, admin_key, user_jwt, base_url):
    """Test if container can reach other containers' IPs."""
    print("\n[Test D] Cross-Container Network Access")
    print("  Attempting to reach other pods in default namespace...")
    
    # Try to curl another pod's gateway port
    cmd = (
        "for ip in 10.244.0.1 10.244.0.2 10.244.0.3; do "
        "  timeout 2 curl -s http://$ip:18789/ 2>&1 | head -1 && echo \" REACHED $ip\" || echo \" $ip unreachable\"; "
        "done"
    )
    result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=15)
    output = result.get("output", "")
    print(f"  Output: {output[:200]}")
    
    return {"test": "cross_container_network", "output": output}


def main():
    parser = argparse.ArgumentParser(description="Test container isolation security")
    parser.add_argument("container_id", type=int, help="Container ID to test")
    parser.add_argument("--base-url", default="http://localhost:42900")
    parser.add_argument("--admin-api-key", required=True)
    parser.add_argument("--user-jwt", required=True)
    args = parser.parse_args()

    print("=" * 60)
    print("CONTAINER ISOLATION SECURITY TEST")
    print("=" * 60)
    print(f"\nContainer ID: {args.container_id}")
    print("Mode: Malicious Skill Attack Simulation")
    print("\n[!] WARNING: Only run in a controlled test environment.\n")

    results = []
    results.append(test_cross_user_data_access(args.container_id, args.admin_api_key, args.user_jwt, args.base_url))
    results.append(test_host_key_exfiltration(args.container_id, args.admin_api_key, args.user_jwt, args.base_url))
    results.append(test_container_escape(args.container_id, args.admin_api_key, args.user_jwt, args.base_url))
    results.append(test_cross_container_network(args.container_id, args.admin_api_key, args.user_jwt, args.base_url))

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    all_blocked = all(r.get("blocked", True) for r in results)
    if all_blocked:
        print("  ✅ ALL ATTACKS BLOCKED — Container isolation effective")
    else:
        print("  ❌ SOME ATTACKS SUCCEEDED — Security issue detected")
        for r in results:
            if not r.get("blocked", True):
                print(f"    - {r['test']}: LEAKED/BYPASSED")
    print("=" * 60)

    print(json.dumps({"all_blocked": all_blocked, "results": results}, indent=2))


if __name__ == "__main__":
    main()
