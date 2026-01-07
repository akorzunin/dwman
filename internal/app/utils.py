import base64
import os

import requests


def encode_b64(client_id: str, client_secret: str) -> str:
    client_creds = f"{client_id}:{client_secret}"
    client_creds_b64 = base64.b64encode(client_creds.encode())
    return client_creds_b64.decode()


def get_access_token(refresh_token: str) -> dict:
    client_creds_b64 = encode_b64(
        os.environ["SPOTIPY_CLIENT_ID"],
        os.environ["SPOTIPY_CLIENT_SECRET"],
    )

    return requests.post(
        url="https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={
            "Authorization": f"Basic {client_creds_b64}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    ).json()
