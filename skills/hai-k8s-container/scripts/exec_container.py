#!/usr/bin/env python3
"""
Execute command in a hai-k8s container via skill API.

This script is used by the hai-k8s-container skill to execute commands
in user containers through the hai-k8s backend API.

Usage:
    python exec_container.py <container_id> <command> [--timeout N] [--base-url URL]

Author: Zhengde ZHANG
"""
import argparse
import json
import sys
import urllib.request
import urllib.error


def exec_container(
    container_id: int,
    command: str,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
    timeout: int = 30,
) -> dict:
    """
    Execute a command in a container via hai-k8s skill API.

    Args:
        container_id: The container ID
        command: Command to execute
        admin_api_key: Shared admin API key
        user_jwt_token: User's JWT token
        base_url: hai-k8s backend base URL
        timeout: Command timeout in seconds

    Returns:
        dict with keys: success, output, error, exit_code
    """
    url = f"{base_url}/api/skills/containers/{container_id}/exec"

    payload = {
        "command": command,
        "timeout": timeout,
    }

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
            result = json.loads(resp.read().decode("utf-8"))
            return {
                "success": result.get("success", False),
                "output": result.get("output", ""),
                "error": result.get("error", ""),
                "exit_code": result.get("exit_code", -1),
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8") if e.fp else ""
        try:
            error_detail = json.loads(error_body).get("detail", error_body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            error_detail = error_body or str(e)
        return {
            "success": False,
            "output": "",
            "error": f"HTTP {e.code}: {error_detail}",
            "exit_code": -1,
        }
    except urllib.error.URLError as e:
        return {
            "success": False,
            "output": "",
            "error": f"Connection error: {e.reason}",
            "exit_code": -1,
        }


def main():
    parser = argparse.ArgumentParser(description="Execute command in hai-k8s container")
    parser.add_argument("container_id", type=int, help="Container ID")
    parser.add_argument("command", type=str, help="Command to execute")
    parser.add_argument("--timeout", type=int, default=30, help="Timeout in seconds (default: 30)")
    parser.add_argument("--base-url", default="http://localhost:42900", help="hai-k8s backend URL")
    parser.add_argument("--admin-api-key", required=True, help="Admin API Key (X-Admin-API-Key)")
    parser.add_argument("--user-jwt", required=True, help="User JWT token (Authorization: Bearer)")
    parser.add_argument(
        "--format",
        choices=["json", "simple"],
        default="simple",
        help="Output format: json or simple text",
    )

    args = parser.parse_args()

    result = exec_container(
        container_id=args.container_id,
        command=args.command,
        admin_api_key=args.admin_api_key,
        user_jwt_token=args.user_jwt,
        base_url=args.base_url,
        timeout=args.timeout,
    )

    if args.format == "json":
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        if not result["success"]:
            print(f"ERROR: {result['error']}", file=sys.stderr)
            sys.exit(result["exit_code"] if result["exit_code"] != -1 else 1)
        if result["output"]:
            print(result["output"])
        if result["error"]:
            print(f"STDERR: {result['error']}", file=sys.stderr)
        sys.exit(result["exit_code"])


if __name__ == "__main__":
    main()
