"""
Fetch API key for a user from HepAI API service.

Usage:
    python fetch_api_key_for_user.py <username>
    e.g. python fetch_api_key_for_user.py zhangzd@ihep.ac.cn
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from pydantic import BaseModel, Field
from config import Config


FETCH_API_KEY_URL = "https://aiapi.ihep.ac.cn/apiv2/key/fetch_api_key"


class FetchAPIKeyRequest(BaseModel):
    username: str = Field(..., description="Username, i.e. xxx@ihep.ac.cn")


def fetch_api_key(username: str) -> dict:
    admin_key = Config.HEPAI_SUBAPP_ADMIN_KEY
    if not admin_key:
        raise ValueError("HEPAI_SUBAPP_ADMIN_KEY is not set in environment variables")

    payload = FetchAPIKeyRequest(username=username)
    response = requests.post(
        FETCH_API_KEY_URL,
        json=payload.model_dump(),
        headers={
            "Authorization": f"Bearer {admin_key}",
            "Content-Type": "application/json",
        },
        timeout=10,
    )
    try:
        response.raise_for_status()
    except requests.HTTPError as e:
        print(f"HTTP error occurred: {e}")
        print(f"Response content: {response.text}")
        raise
    return response.json()


if __name__ == "__main__":

    username = "zdzhang@ihep.ac.cn"
    print(f"Fetching API key for user: {username}")

    result = fetch_api_key(username)
    print("Response:", result)

    # Expected output format:
    """
    Response: {'id': '26ace726-45bd-45c3-875a-ca8417e12151', 'api_key': 'sk-xxx', 'alias': 'AppKey-of-zdzhang@ihep.ac.cn-for-haidora@ihep.ac.cn', 'user_id': '733a12b9-9abe-441b-aef2-f9ede29122e7', 'username': 'zdzhang@ihep.ac.cn', 'expiration_time': '2126-02-06T20:37:31.905668', 'usage_description': None, 'create_time': '2026-03-02T20:37:31.905868', 'created_by': 'haidora@ihep.ac.cn', 'update_time': '2026-03-02T20:37:31.905871', 'updated_by': 'haidora@ihep.ac.cn', 'allowed_models': 'all', 'remarks': 'API-KEY of `zdzhang@ihep.ac.cn` created by app admin: `haidora@ihep.ac.cn`', 'app_group': 'haidora@ihep.ac.cn', 'del_flag': False}
    """
