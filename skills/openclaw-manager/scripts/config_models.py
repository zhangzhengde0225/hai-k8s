#!/usr/bin/env python3
"""
Configure OpenClaw models via hai-k8s skill API.

Reads models_config_template from hai-k8s, replaces ${HEPAI_API_KEY},
and writes the merged config to ~/.openclaw/openclaw.json.

Usage:
    python config_models.py <container_id> <hepai_api_key> [--base-url URL]

Author: Zhengde ZHANG
"""
import argparse
import json
import sys
import urllib.request
import urllib.error
import os
import subprocess


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


def build_openclaw_config(models_template: dict, hepai_api_key: str) -> dict:
    """
    Build full openclaw.json config from models template.
    Replaces ${HEPAI_API_KEY} with actual key.
    """
    config_str = json.dumps(models_template)
    config_str = config_str.replace("${HEPAI_API_KEY}", hepai_api_key)
    return json.loads(config_str)


def config_models(
    container_id: int,
    hepai_api_key: str,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
) -> dict:
    """
    Main function: fetch template, replace API key, write to container.
    Returns dict with success status and details.
    """
    # Step 1: Get template from hai-k8s
    print("Fetching models_config_template from hai-k8s...")
    template_result = get_config_template("openclaw", admin_api_key, user_jwt_token, base_url)
    if "error" in template_result:
        return {"success": False, "step": "fetch_template", "error": template_result["error"]}

    models_template = template_result.get("models_config_template")
    if not models_template:
        return {"success": False, "step": "fetch_template", "error": "models_config_template is empty"}

    # Step 2: Build config with replaced API key
    print("Building config with HEPAI_API_KEY...")
    try:
        full_config = build_openclaw_config(models_template, hepai_api_key)
    except json.JSONDecodeError as e:
        return {"success": False, "step": "build_config", "error": f"JSON error: {e}"}

    config_json = json.dumps(full_config, indent=2, ensure_ascii=False)

    # Step 3: Write to container's ~/.openclaw/openclaw.json
    # Use base64 to safely pass JSON through shell
    encoded = config_json.replace("'", "'\"'\"'")
    b64 = __import__("base64").b64encode(config_json.encode()).decode()

    print("Writing config to ~/.openclaw/openclaw.json...")
    # Create dir and write file via base64 decode
    cmds = [
        "mkdir -p ~/.openclaw",
        f"echo '{b64}' | base64 -d > ~/.openclaw/openclaw.json",
        "chmod 600 ~/.openclaw/openclaw.json",
        "echo 'Config written successfully'",
    ]
    for cmd in cmds:
        result = exec_in_container(container_id, cmd, admin_api_key, user_jwt_token, base_url, timeout=30)
        if not result.get("success"):
            return {
                "success": False,
                "step": "write_config",
                "command": cmd,
                "error": result.get("error", "unknown"),
                "exit_code": result.get("exit_code", -1),
            }

    # Step 4: Verify
    verify = exec_in_container(
        container_id,
        "cat ~/.openclaw/openclaw.json | head -20",
        admin_api_key,
        user_jwt_token,
        base_url,
        timeout=30,
    )
    if not verify.get("success"):
        return {"success": False, "step": "verify", "error": verify.get("error")}

    print("Models configured successfully.")
    return {
        "success": True,
        "output": verify.get("output", ""),
    }


def main():
    parser = argparse.ArgumentParser(description="Configure OpenClaw models")
    parser.add_argument("container_id", type=int, help="Container ID")
    parser.add_argument("hepai_api_key", help="HEPAI API Key (replaces ${HEPAI_API_KEY} in template)")
    parser.add_argument("--base-url", default="http://localhost:42900", help="hai-k8s backend URL")
    parser.add_argument("--admin-api-key", required=True, help="Admin API Key")
    parser.add_argument("--user-jwt", required=True, help="User JWT token")
    args = parser.parse_args()

    result = config_models(
        container_id=args.container_id,
        hepai_api_key=args.hepai_api_key,
        admin_api_key=args.admin_api_key,
        user_jwt_token=args.user_jwt,
        base_url=args.base_url,
    )

    if args.admin_api_key == "test":
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    if result["success"]:
        print("OK: Models configured successfully")
        print(result.get("output", ""))
    else:
        print(f"FAILED at step '{result.get('step', 'unknown')}': {result.get('error', 'unknown')}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
