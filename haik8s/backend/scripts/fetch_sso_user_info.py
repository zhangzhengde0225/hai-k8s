"""
Fetch user info from IHEP SSO service.

Usage:
    python fetch_sso_user_info.py <username>
    e.g. python fetch_sso_user_info.py luoq@ihep.ac.cn

Returns user info including:
    - sn: cluster account name (e.g. "luoq"), null if no cluster account
    - uid: user UID
    - homedir: user home directory
    - trueName, identity, orgUnitId, etc.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import requests


SEARCH_USER_INFO_URL = "https://newlogin.ihep.ac.cn/api/searchUserInfo"


def fetch_sso_user_info(username: str) -> dict:
    """
    Fetch user info from IHEP SSO by email/username.

    Returns the full data dict on success, raises on HTTP error.
    Key fields:
        sn       - cluster account (None if not assigned)
        uid      - Linux UID
        homedir  - home directory path
    """
    response = requests.get(
        SEARCH_USER_INFO_URL,
        params={"username": username},
        timeout=10,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as e:
        print(f"HTTP error occurred: {e}")
        print(f"Response content: {response.text}")
        raise

    body = response.json()
    if body.get("code") != 1:
        raise ValueError(f"SSO API returned error: {body.get('msg')} (code={body.get('code')})")

    return body["data"]


if __name__ == "__main__":
    username = sys.argv[1] if len(sys.argv) > 1 else "zdzhang@ihep.ac.cn"
    print(f"Fetching SSO user info for: {username}")

    data = fetch_sso_user_info(username)
    cluster_username = data.get('sn')
    print(f"  trueName         : {data.get('trueName', '').strip()}")
    print(f"  cluster_username : {cluster_username}")
    print(f"  uid (SSO)        : {data.get('uid')}")
    print(f"  homedir          : {data.get('homedir')}")
    print(f"  identity         : {data.get('identity')}")
    print(f"  orgUnitId        : {data.get('orgUnitId')}")

    if cluster_username:
        import pwd
        try:
            pw = pwd.getpwnam(cluster_username)
            print(f"\n  --- id {cluster_username} ---")
            print(f"  uid              : {pw.pw_uid}")
            print(f"  gid              : {pw.pw_gid}")
            print(f"  home_dir         : {pw.pw_dir}")
        except KeyError:
            print(f"\n  [!] '{cluster_username}' not found in local passwd database")

    print(f"\nFull SSO response: {data}")
