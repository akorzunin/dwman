from unittest import mock
from urllib.parse import parse_qs, urlparse

from fastapi.testclient import TestClient

from internal.settings import SPOTIPY_REDIRECT_URL


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
