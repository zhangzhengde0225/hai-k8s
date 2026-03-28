#!/usr/bin/env python3
"""
Initialize OpenClaw in a hai-k8s container.

Executes the full 4-step initialization sequence:
  1. openclaw onboard (non-interactive registration)
  2. Enable insecure HTTP auth
  3. Configure models (replace ${HEPAI_API_KEY})
  4. Start gateway

Usage:
    python init_openclaw.py <container_id> <hepai_api_key> [--base-url URL]

Author: Zhengde ZHANG
"""
import argparse
import json
import sys
import urllib.request
import urllib.error
import os


def exec_in_container(
    container_id: int,
    command: str,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
    timeout: int = 60,
) -> dict:
    """Execute command in container via hai-k8s skill API."""
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


def get_container(
    container_id: int,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
) -> dict:
    """Get container details."""
    url = f"{base_url}/api/containers/{container_id}"
    req = urllib.request.Request(
        url,
        headers={
            "X-Admin-API-Key": admin_api_key,
            "Authorization": f"Bearer {user_jwt_token}",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        try:
            detail = json.loads(body).get("detail", body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            detail = body or str(e)
        return {"error": f"HTTP {e.code}: {detail}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection error: {e.reason}"}


def get_config_template(
    app_id: str,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
) -> dict:
    """Fetch models_config_template from hai-k8s API."""
    url = f"{base_url}/api/skills/applications/{app_id}/config-template"
    req = urllib.request.Request(
        url,
        headers={
            "X-Admin-API-Key": admin_api_key,
            "Authorization": f"Bearer {user_jwt_token}",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8") if e.fp else ""
        try:
            detail = json.loads(body).get("detail", body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            detail = body or str(e)
        return {"error": f"HTTP {e.code}: {detail}"}
    except urllib.error.URLError as e:
        return {"error": f"Connection error: {e.reason}"}


def step1_onboard(container_id: int, password: str, admin_api_key: str, user_jwt: str, base_url: str) -> dict:
    """Step 1: Non-interactive onboard."""
    print("[Step 1/4] Running openclaw onboard...")
    cmd = (
        "openclaw onboard "
        "--non-interactive "
        "--accept-risk "
        "--flow quickstart "
        "--mode local "
        "--gateway-bind lan "
        "--gateway-auth token "
        f"--gateway-password '{password}' "
        "--skip-channels "
        "--skip-skills "
        "--skip-health "
        "--install-daemon 2>&1"
    )
    result = exec_in_container(container_id, cmd, admin_api_key, user_jwt, base_url, timeout=120)
    if result.get("success"):
        print("  onboard: OK")
    else:
        print(f"  onboard: FAILED - {result.get('error')}")
    return result


def step2_enable_insecure_http(container_id: int, admin_api_key: str, user_jwt: str, base_url: str) -> dict:
    """Step 2: Enable insecure HTTP auth in openclaw.json."""
    print("[Step 2/4] Enabling insecure HTTP auth...")
    # Use jq to add controlUi to gateway section
    cmd = (
        "if [ -f ~/.openclaw/openclaw.json ]; then "
        "  jq '.gateway.controlUi = {\"allowInsecureAuth\": true}' "
        "  ~/.openclaw/openclaw.json > /tmp/openclaw_new.json "
        "  && mv /tmp/openclaw_new.json ~/.openclaw/openclaw.json "
        "  && echo 'Insecure HTTP enabled'; "
        "else echo 'openclaw.json not found'; fi"
    )
    result = exec_in_container(container_id, cmd, admin_api_key, user_jwt, base_url, timeout=30)
    if result.get("success"):
        print("  insecure http: OK")
    else:
        print(f"  insecure http: FAILED - {result.get('error')}")
    return result


def step3_config_models(
    container_id: int,
    hepai_api_key: str,
    admin_api_key: str,
    user_jwt: str,
    base_url: str,
) -> dict:
    """Step 3: Fetch template, replace API key, write config."""
    print("[Step 3/4] Configuring models...")

    # Fetch template
    template_result = get_config_template("openclaw", admin_api_key, user_jwt, base_url)
    if "error" in template_result:
        return {"success": False, "step": "fetch_template", "error": template_result["error"]}

    models_template = template_result.get("models_config_template")
    if not models_template:
        return {"success": False, "step": "fetch_template", "error": "models_config_template is empty"}

    # Build config with replaced API key
    config_str = json.dumps(models_template)
    config_str = config_str.replace("${HEPAI_API_KEY}", hepai_api_key)
    try:
        full_config = json.loads(config_str)
    except json.JSONDecodeError as e:
        return {"success": False, "step": "parse_config", "error": f"JSON error: {e}"}

    config_json = json.dumps(full_config, indent=2, ensure_ascii=False)
    b64 = __import__("base64").b64encode(config_json.encode()).decode()

    # Write to container
    cmds = [
        "mkdir -p ~/.openclaw",
        f"echo '{b64}' | base64 -d > ~/.openclaw/openclaw.json",
        "chmod 600 ~/.openclaw/openclaw.json",
    ]
    for cmd in cmds:
        result = exec_in_container(container_id, cmd, admin_api_key, user_jwt, base_url, timeout=30)
        if not result.get("success"):
            return {"success": False, "step": "write_config", "command": cmd, "error": result.get("error")}

    print("  models: OK")
    return {"success": True}


def step4_start_gateway(container_id: int, admin_api_key: str, user_jwt: str, base_url: str) -> dict:
    """Step 4: Start gateway in background."""
    print("[Step 4/4] Starting gateway (background)...")
    # Kill any existing gateway process
    # Start in background with nohup, redirect output to log file
    cmd = (
        "pkill -f 'openclaw gateway' 2>/dev/null || true; "
        "mkdir -p ~/.openclaw/logs; "
        "export TZ='Asia/Shanghai'; "
        "nohup openclaw gateway --port 18789 --bind lan "
        "> ~/.openclaw/logs/gateway.log 2>&1 & "
        "echo \"Gateway started with PID $!\"; "
        "sleep 2; "
        "ss -tlnp | grep 18789 || echo 'Port check: gateway may still be starting'"
    )
    result = exec_in_container(container_id, cmd, admin_api_key, user_jwt, base_url, timeout=30)
    if result.get("success"):
        print("  gateway: OK")
        if result.get("output"):
            print(f"  output: {result['output']}")
    else:
        print(f"  gateway: FAILED - {result.get('error')}")
    return result


def init_openclaw(
    container_id: int,
    hepai_api_key: str,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
    gateway_password: str = None,
) -> dict:
    """
    Run full OpenClaw initialization sequence.

    Returns dict with overall success status and per-step details.
    """
    # Get container info to find password
    print(f"Initializing OpenClaw in container {container_id}...")
    container_info = get_container(container_id, admin_api_key, user_jwt_token, base_url)
    if "error" in container_info:
        return {"success": False, "error": f"Failed to get container: {container_info['error']}"}

    # Determine password
    password = gateway_password
    if not password:
        password = container_info.get("root_password") or container_info.get("user_password") or "test123"

    print(f"Using gateway password: {'*' * len(password)}")

    # Run steps
    steps = [
        ("onboard", step1_onboard(container_id, password, admin_api_key, user_jwt_token, base_url)),
        ("insecure_http", step2_enable_insecure_http(container_id, admin_api_key, user_jwt_token, base_url)),
        ("config_models", step3_config_models(container_id, hepai_api_key, admin_api_key, user_jwt_token, base_url)),
        ("start_gateway", step4_start_gateway(container_id, admin_api_key, user_jwt_token, base_url)),
    ]

    # Collect results
    results = {}
    all_success = True
    for name, result in steps:
        results[name] = result
        if not result.get("success"):
            all_success = False

    if all_success:
        print("\nOpenClaw initialization completed successfully!")
    else:
        print("\nOpenClaw initialization completed with errors.")

    return {
        "success": all_success,
        "container_id": container_id,
        "steps": results,
    }


def main():
    parser = argparse.ArgumentParser(description="Initialize OpenClaw in hai-k8s container")
    parser.add_argument("container_id", type=int, help="Container ID")
    parser.add_argument("hepai_api_key", help="HEPAI API Key")
    parser.add_argument("--base-url", default="http://localhost:42900", help="hai-k8s backend URL")
    parser.add_argument("--admin-api-key", required=True, help="Admin API Key")
    parser.add_argument("--user-jwt", required=True, help="User JWT token")
    parser.add_argument("--gateway-password", help="Gateway password (auto-detected if not provided)")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format")
    args = parser.parse_args()

    result = init_openclaw(
        container_id=args.container_id,
        hepai_api_key=args.hepai_api_key,
        admin_api_key=args.admin_api_key,
        user_jwt_token=args.user_jwt,
        base_url=args.base_url,
        gateway_password=args.gateway_password,
    )

    if args.format == "json":
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        if result["success"]:
            print("\nAll steps completed successfully.")
        else:
            print("\nSome steps failed:")
            for name, r in result.get("steps", {}).items():
                if not r.get("success"):
                    print(f"  {name}: {r.get('error') or r.get('output', 'unknown error')}")
            sys.exit(1)


if __name__ == "__main__":
    main()
