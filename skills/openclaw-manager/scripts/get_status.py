#!/usr/bin/env python3
"""
Check OpenClaw status in a hai-k8s container.

Checks:
  - openclaw onboard status
  - gateway running and port 18789
  - config file exists and is valid JSON

Usage:
    python get_status.py <container_id> [--base-url URL]

Author: Zhengde ZHANG
"""
import argparse
import json
import urllib.request
import urllib.error


def exec_in_container(
    container_id: int,
    command: str,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
    timeout: int = 30,
) -> dict:
    url = f"{base_url}/api/skills/containers/{container_id}/exec"
    payload = {"command": command, "timeout": timeout}
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "X-Admin-API-Key": admin_api_key,
            "Authorization": f"Bearer {user_jwt_token}",
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


def get_status(
    container_id: int,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
) -> dict:
    checks = {}

    # Check 1: openclaw status
    print("[1/4] Checking openclaw onboard status...")
    r = exec_in_container(container_id, "openclaw status 2>&1", admin_api_key, user_jwt_token, base_url)
    onboard_ok = r.get("success") and r.get("exit_code") == 0
    checks["onboard"] = {"ok": onboard_ok, "output": r.get("output", ""), "error": r.get("error", "")}

    # Check 2: Gateway process
    print("[2/4] Checking gateway process...")
    r = exec_in_container(container_id, "pgrep -f 'openclaw gateway' && echo 'RUNNING' || echo 'NOT_RUNNING'", admin_api_key, user_jwt_token, base_url)
    gateway_ok = r.get("success") and "RUNNING" in r.get("output", "")
    checks["gateway_process"] = {"ok": gateway_ok, "output": r.get("output", "").strip()}

    # Check 3: Port 18789
    print("[3/4] Checking port 18789...")
    r = exec_in_container(container_id, "ss -tlnp | grep 18789 || echo 'PORT_NOT_LISTENING'", admin_api_key, user_jwt_token, base_url)
    port_ok = r.get("success") and "18789" in r.get("output", "")
    checks["port_18789"] = {"ok": port_ok, "output": r.get("output", "").strip()}

    # Check 4: Config file valid JSON
    print("[4/4] Checking config file...")
    r = exec_in_container(container_id, "python3 -c \"import json,json; f=open('/root/.openclaw/openclaw.json'); json.load(f); print('VALID_JSON')\" 2>&1 || echo 'INVALID_JSON'", admin_api_key, user_jwt_token, base_url)
    config_ok = r.get("success") and "VALID_JSON" in r.get("output", "")
    checks["config_valid"] = {"ok": config_ok, "output": r.get("output", "").strip()}

    all_ok = all(c["ok"] for c in checks.values())
    return {"success": all_ok, "checks": checks}


def main():
    parser = argparse.ArgumentParser(description="Check OpenClaw status in container")
    parser.add_argument("container_id", type=int, help="Container ID")
    parser.add_argument("--base-url", default="http://localhost:42900", help="hai-k8s backend URL")
    parser.add_argument("--admin-api-key", required=True, help="Admin API Key")
    parser.add_argument("--user-jwt", required=True, help="User JWT token")
    args = parser.parse_args()

    result = get_status(
        container_id=args.container_id,
        admin_api_key=args.admin_api_key,
        user_jwt_token=args.user_jwt,
        base_url=args.base_url,
    )

    print("\n=== OpenClaw Status ===")
    for name, check in result.get("checks", {}).items():
        status = "✅ OK" if check["ok"] else "❌ FAIL"
        print(f"  {status}  {name}: {check['output'][:80]}")

    print(f"\nOverall: {'✅ Ready' if result['success'] else '❌ Not Ready'}")
    if not result["success"]:
        import sys
        sys.exit(1)


if __name__ == "__main__":
    main()
