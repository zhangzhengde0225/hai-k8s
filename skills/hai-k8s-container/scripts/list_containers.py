#!/usr/bin/env python3
"""
List containers and get container details from hai-k8s.

This script is used by the hai-k8s-container skill to query
container information through the hai-k8s backend API.

Usage:
    python list_containers.py list [--app-id openclaw] [--base-url URL]
    python list_containers.py get <container_id> [--base-url URL]

Author: Zhengde ZHANG
"""
import argparse
import json
import urllib.request
import urllib.error


def list_applications(
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
) -> dict:
    """List user's application configurations."""
    url = f"{base_url}/api/applications"
    return _get(url, admin_api_key, user_jwt_token)


def list_instances(
    app_id: str,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
) -> dict:
    """List instances for a specific application."""
    url = f"{base_url}/api/applications/{app_id}/instances"
    return _get(url, admin_api_key, user_jwt_token)


def get_container(
    container_id: int,
    admin_api_key: str,
    user_jwt_token: str,
    base_url: str = "http://localhost:42900",
) -> dict:
    """Get detailed container information."""
    url = f"{base_url}/api/containers/{container_id}"
    return _get(url, admin_api_key, user_jwt_token)


def _get(url: str, admin_api_key: str, user_jwt_token: str) -> dict:
    """Make authenticated GET request."""
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
        error_body = e.read().decode("utf-8") if e.fp else ""
        try:
            error_detail = json.loads(error_body).get("detail", error_body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            error_detail = error_body or str(e)
        return {"error": f"HTTP {e.code}: {error_detail}", "success": False}
    except urllib.error.URLError as e:
        return {"error": f"Connection error: {e.reason}", "success": False}


def main():
    parser = argparse.ArgumentParser(description="List hai-k8s containers")
    parser.add_argument("--base-url", default="http://localhost:42900", help="hai-k8s backend URL")
    parser.add_argument("--admin-api-key", required=True, help="Admin API Key (X-Admin-API-Key)")
    parser.add_argument("--user-jwt", required=True, help="User JWT token (Authorization: Bearer)")
    sub = parser.add_subparsers(dest="action", help="Action to perform")

    # list-applications
    p_list = sub.add_parser("list", help="List user applications")
    p_list.add_argument("--app-id", help="Filter by app ID (e.g. openclaw)")

    # get
    p_get = sub.add_parser("get", help="Get container details")
    p_get.add_argument("container_id", type=int, help="Container ID")

    args = parser.parse_args()

    if args.action == "list":
        if args.app_id:
            result = list_instances(args.app_id, args.admin_api_key, args.user_jwt, args.base_url)
        else:
            result = list_applications(args.admin_api_key, args.user_jwt, args.base_url)
        print(json.dumps(result, indent=2, ensure_ascii=False))

    elif args.action == "get":
        result = get_container(args.container_id, args.admin_api_key, args.user_jwt, args.base_url)
        print(json.dumps(result, indent=2, ensure_ascii=False))

    else:
        parser.print_help()
        return


if __name__ == "__main__":
    main()
