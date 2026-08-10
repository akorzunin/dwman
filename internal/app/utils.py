import base64

import requests
from pydantic import ValidationError

from internal.app.shemas import SpotifyToken
from internal.settings import SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET


class SpotifyTokenError(RuntimeError):
    def __init__(self, status_code: int, error: str):
        self.status_code = status_code
        self.error = error
        super().__init__(f"Spotify token request failed: {error}")


def parse_spotify_token_response(response: requests.Response) -> dict:
    raw_status_code = getattr(response, "status_code", 200)
    status_code = raw_status_code if isinstance(raw_status_code, int) else 200
    try:
        data = response.json()
    except (TypeError, ValueError) as exc:
        raise SpotifyTokenError(status_code, "invalid_response") from exc

    if (
        not isinstance(data, dict)
        or not 200 <= status_code < 300
        or "error" in data
    ):
        error = (
            data.get("error", "invalid_response")
            if isinstance(data, dict)
            else "invalid_response"
        )
        raise SpotifyTokenError(status_code, str(error))

    try:
        SpotifyToken.model_validate(data)
    except ValidationError as exc:
        raise SpotifyTokenError(status_code, "invalid_response") from exc
    return data


def encode_b64(client_id: str, client_secret: str) -> str:
    client_creds = f"{client_id}:{client_secret}"
    client_creds_b64 = base64.b64encode(client_creds.encode())
    return client_creds_b64.decode()


def get_access_token(refresh_token: str) -> dict:
    try:
        response = requests.post(
            url="https://accounts.spotify.com/api/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
            },
            headers={
                "Authorization": f"Basic {encode_b64(SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET)}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
    except requests.RequestException as exc:
        raise SpotifyTokenError(502, "request_failed") from exc
    return parse_spotify_token_response(response)
