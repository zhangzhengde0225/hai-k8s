#!/usr/bin/env python3
"""
Measure OpenClaw agent cold-start latency.

Run this script in a hai-k8s environment with K8s access to measure
the full cold-start breakdown of an OpenClaw agent container.

Usage:
    python3 measure_cold_start.py --container-id <id> [--admin-key KEY] [--user-jwt TOKEN]

Author: Zhengde ZHANG
Date: 2026-03-28
"""
import argparse
import json
import time
import urllib.request
import urllib.error
import sys


def exec_in_container(container_id, command, admin_key, user_jwt, base_url="http://localhost:42900", timeout=60):
    """Execute command in container via hai-k8s skill API."""
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


def measure_onboard(container_id, password, admin_key, user_jwt, base_url):
    """Measure openclaw onboard time."""
    print("\n[1/4] Measuring openclaw onboard...")
    cmd = (
        "time openclaw onboard --non-interactive --accept-risk --flow quickstart "
        "--mode local --gateway-bind lan --gateway-auth token "
        f"--gateway-password '{password}' --skip-channels --skip-skills "
        "--skip-health --install-daemon 2>&1"
    )
    start = time.time()
    result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=120)
    elapsed = time.time() - start
    success = result.get("success") and result.get("exit_code") == 0
    print(f"  Result: {'OK' if success else 'FAILED'}")
    if not success:
        print(f"  Error: {result.get('error')}")
    return {"step": "onboard", "elapsed": elapsed, "success": success, "output": result.get("output", "")}


def measure_insecure_http(container_id, admin_key, user_jwt, base_url):
    """Measure insecure HTTP enable time."""
    print("\n[2/4] Measuring insecure HTTP enable...")
    cmd = (
        "python3 -c \"import json; "
        "d=json.load(open('/root/.openclaw/openclaw.json')); "
        "d.setdefault('gateway',{})['controlUi']={'allowInsecureAuth':True}; "
        "json.dump(d,open('/root/.openclaw/openclaw.json','w'),indent=2)\" 2>&1"
    )
    start = time.time()
    result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=30)
    elapsed = time.time() - start
    success = result.get("success") and result.get("exit_code") == 0
    print(f"  Result: {'OK' if success else 'FAILED'}")
    if not success:
        print(f"  Error: {result.get('error')}")
    return {"step": "insecure_http", "elapsed": elapsed, "success": success}


def measure_config_models(container_id, hepai_api_key, admin_key, user_jwt, base_url):
    """Measure model config time."""
    print("\n[3/4] Measuring model config...")
    # Fetch template
    url = f"{base_url}/api/skills/applications/openclaw/config-template"
    req = urllib.request.Request(
        url,
        headers={"X-Admin-API-Key": admin_key, "Authorization": f"Bearer {user_jwt}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            template = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"step": "config_models", "elapsed": 0, "success": False, "error": str(e)}

    models = template.get("models_config_template", {})
    if not models:
        return {"step": "config_models", "elapsed": 0, "success": False, "error": "Empty template"}

    # Build config
    config_str = json.dumps(models).replace("${HEPAI_API_KEY}", hepai_api_key)
    b64 = __import__("base64").b64encode(config_str.encode()).decode()

    # Write to container
    cmds = [
        "mkdir -p ~/.openclaw",
        f"echo '{b64}' | base64 -d > ~/.openclaw/openclaw.json",
    ]
    total_elapsed = 0
    for cmd in cmds:
        start = time.time()
        result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=30)
        elapsed = time.time() - start
        total_elapsed += elapsed
        if not result.get("success"):
            return {"step": "config_models", "elapsed": total_elapsed, "success": False, "error": result.get("error")}
    print(f"  Result: OK ({total_elapsed:.3f}s)")
    return {"step": "config_models", "elapsed": total_elapsed, "success": True}


def measure_gateway_start(container_id, admin_key, user_jwt, base_url):
    """Measure gateway startup time."""
    print("\n[4/4] Measuring gateway startup...")
    cmd = (
        "pkill -f 'openclaw gateway' 2>/dev/null || true; "
        "export TZ='Asia/Shanghai'; "
        "nohup openclaw gateway --port 18789 --bind lan "
        "> ~/.openclaw/logs/gateway.log 2>&1 & "
        "sleep 2 && ss -tlnp | grep 18789 && echo 'GATEWAY_OK'"
    )
    start = time.time()
    result = exec_in_container(container_id, cmd, admin_key, user_jwt, base_url, timeout=30)
    elapsed = time.time() - start
    success = result.get("success") and "GATEWAY_OK" in result.get("output", "")
    print(f"  Result: {'OK' if success else 'FAILED'}")
    if not success:
        print(f"  Output: {result.get('output', '')[:200]}")
    return {"step": "gateway_start", "elapsed": elapsed, "success": success}


def main():
    parser = argparse.ArgumentParser(description="Measure OpenClaw cold-start latency")
    parser.add_argument("container_id", type=int, help="Container ID")
    parser.add_argument("hepai_api_key", help="HEPAI API Key")
    parser.add_argument("--gateway-password", default="test123", help="Gateway password")
    parser.add_argument("--base-url", default="http://localhost:42900", help="hai-k8s backend URL")
    parser.add_argument("--admin-api-key", required=True, help="Admin API Key")
    parser.add_argument("--user-jwt", required=True, help="User JWT token")
    args = parser.parse_args()

    results = []
    total_start = time.time()

    results.append(measure_onboard(args.container_id, args.gateway_password, args.admin_api_key, args.user_jwt, args.base_url))
    results.append(measure_insecure_http(args.container_id, args.admin_api_key, args.user_jwt, args.base_url))
    results.append(measure_config_models(args.container_id, args.hepai_api_key, args.admin_api_key, args.user_jwt, args.base_url))
    results.append(measure_gateway_start(args.container_id, args.admin_api_key, args.user_jwt, args.base_url))

    total_elapsed = time.time() - total_start

    print("\n" + "=" * 60)
    print("COLD-START RESULTS")
    print("=" * 60)
    total = 0
    for r in results:
        status = "✅" if r["success"] else "❌"
        print(f"  {status} {r['step']}: {r['elapsed']:.3f}s")
        if r["success"]:
            total += r["elapsed"]
    print("-" * 60)
    print(f"  Total initialization time: {total:.3f}s (measured)")
    print(f"  Total elapsed (incl overhead): {total_elapsed:.3f}s")
    print("=" * 60)

    output = {
        "total_measured": total,
        "total_elapsed": total_elapsed,
        "steps": {r["step"]: {"elapsed": r["elapsed"], "success": r["success"]} for r in results}
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
