from unittest import mock
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from fastapi.testclient import TestClient

from internal.app.db_connector import get_users_table
from internal.settings import SPOTIPY_REDIRECT_URL
from main import app


def test_login_uses_configured_redirect_and_server_generated_state(
    client: TestClient,
):
    response = client.get(
        "/login",
        headers={"Referer": "https://evil.example/steal"},
        follow_redirects=False,
    )

    query = parse_qs(urlparse(response.headers["location"]).query)
    assert query["redirect_uri"] == [SPOTIPY_REDIRECT_URL]
    assert len(query["state"][0]) >= 32
    assert "oauth_session" in response.headers.get("set-cookie", "")


def test_callback_rejects_invalid_oauth_state_before_token_exchange(
    client: TestClient,
):
    client.get("/login", follow_redirects=False)

    with mock.patch("internal.app.routes.front_routes.requests.post") as post:
        response = client.get(
            "/get_token",
            params={"code": "code", "state": "wrong-state"},
            follow_redirects=False,
        )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid OAuth state"
    post.assert_not_called()


@pytest.mark.parametrize("redirect", [True, False])
def test_login_refreshes_existing_user_auth_without_resetting_settings(
    client: TestClient, redirect: bool
):
    user_id = "existing-spotify-user"
    old_token = "old-refresh-token"
    new_token = "new-refresh-token"
    created = client.post(
        "/api/new_user",
        json={
            "user_id": user_id,
            "is_premium": True,
            "refresh_token_hash": old_token,
            "send_mail": True,
            "send_time": "1973-01-06T14:00:00+00:00",
            "tg_chat_id": "123456",
            "dw_playlist_id": "existing-playlist",
        },
    )
    assert created.status_code == 200
    users = app.dependency_overrides[get_users_table]()
    before = dict(users.all()[0])
    login = client.get("/login", follow_redirects=False)
    state = parse_qs(urlparse(login.headers["location"]).query)["state"][0]
    token_response = mock.Mock()
    token_response.status_code = 200
    token_response.json.return_value = {
        "access_token": "access-token",
        "token_type": "Bearer",
        "expires_in": 3600,
        "refresh_token": new_token,
        "scope": "scope",
    }
    spotify = mock.Mock()
    spotify.current_user.return_value = {"id": user_id}
    with (
        mock.patch(
            "internal.app.routes.front_routes.requests.post",
            return_value=token_response,
        ),
        mock.patch(
            "internal.app.routes.front_routes.spotipy.Spotify",
            return_value=spotify,
        ),
    ):
        callback = client.get(
            "/get_token",
            params={"code": "code", "state": state, "redirect": redirect},
            follow_redirects=False,
        )
    assert callback.status_code == (307 if redirect else 300)
    response = client.get(
        "/api/user",
        params={"user_id": user_id},
        auth=httpx.BasicAuth(user_id, new_token),
    )
    assert response.status_code == 200
    assert len(users) == 1
    after = dict(users.all()[0])
    assert after["refresh_token"] == new_token
    for field, value in before.items():
        if field not in ("refresh_token", "refresh_token_hash"):
            assert after[field] == value
    assert (
        client.get(
            "/api/user",
            params={"user_id": user_id},
            auth=httpx.BasicAuth(user_id, old_token),
        ).status_code
        == 401
    )


def test_callback_uses_secure_cookie_attributes(client: TestClient):
    with mock.patch(
        "internal.app.routes.front_routes.SPOTIPY_REDIRECT_URL",
        "https://app.example/get_token",
    ):
        login_response = client.get("/login", follow_redirects=False)
        state = parse_qs(urlparse(login_response.headers["location"]).query)[
            "state"
        ][0]
        token_response = mock.Mock()
        token_response.status_code = 200
        token_response.json.return_value = {
            "access_token": "access-token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": "refresh-token",
            "scope": "scope",
        }
        spotify = mock.Mock()
        spotify.current_user.return_value = {"id": "spotify-user"}

        with (
            mock.patch(
                "internal.app.routes.front_routes.requests.post",
                return_value=token_response,
            ),
            mock.patch(
                "internal.app.routes.front_routes.spotipy.Spotify",
                return_value=spotify,
            ),
        ):
            response = client.get(
                "/get_token",
                params={"code": "code", "state": state},
                headers={"Cookie": f"oauth_session={state}"},
                follow_redirects=False,
            )

    assert response.status_code in (302, 307)
    cookies = response.headers.get_list("set-cookie")
    token_cookies = [
        cookie
        for cookie in cookies
        if "access_token=" in cookie or "refresh_token=" in cookie
    ]
    assert token_cookies
    assert all("Secure" in cookie for cookie in token_cookies)
    assert all("SameSite=lax" in cookie for cookie in token_cookies)
