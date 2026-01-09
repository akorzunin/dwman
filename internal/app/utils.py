import base64

import requests

from internal.settings import SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET


def encode_b64(client_id: str, client_secret: str) -> str:
    client_creds = f"{client_id}:{client_secret}"
    client_creds_b64 = base64.b64encode(client_creds.encode())
    return client_creds_b64.decode()


def get_access_token(refresh_token: str) -> dict:
    return requests.post(
        url="https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={
            "Authorization": f"Basic {encode_b64(SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET)}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    ).json()
