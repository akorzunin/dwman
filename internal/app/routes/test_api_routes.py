from unittest import mock

import bcrypt
import httpx
from fastapi.testclient import TestClient

from internal.app.db_connector import get_users_table
from internal.app.utils import SpotifyTokenError
from main import app

TEST_USER_PASS = "pass"


def setup_user(client: TestClient, **kw) -> tuple[dict, httpx.Response]:
    resp = client.post(
        "/api/new_user",
        json=dict(
            user_id="u123",
            is_premium=False,
            refresh_token="rt_123",
            refresh_token_hash=TEST_USER_PASS,
            **kw,
        ),
    )
    return resp.json(), resp


def auth(user_id: str):
    return httpx.BasicAuth(user_id, TEST_USER_PASS)


def test_refresh_token_rotates_and_updates_authentication(client: TestClient):
    old_refresh_token = "api-old-refresh"
    new_refresh_token = "api-new-refresh"
    client.post(
        "/api/new_user",
        json={
            "user_id": "rotation-api-user",
            "is_premium": False,
            "refresh_token": old_refresh_token,
            "refresh_token_hash": old_refresh_token,
        },
    )

    with mock.patch(
        "internal.app.routes.api_routes.get_access_token",
        return_value={
            "access_token": "access-token",
            "token_type": "Bearer",
            "expires_in": 3600,
            "refresh_token": new_refresh_token,
        },
    ):
        response = client.post(
            "/api/refresh_token",
            json={"refresh_token": old_refresh_token},
        )

    assert response.status_code == 202
    assert response.json()["refresh_token"] == new_refresh_token
    users = app.dependency_overrides[get_users_table]()
    stored_user = users.get(
        lambda value: value["user_id"] == "rotation-api-user"
    )
    assert stored_user["refresh_token"] == new_refresh_token
    assert bcrypt.checkpw(
        new_refresh_token.encode(),
        stored_user["refresh_token_hash"].encode(),
    )

    assert (
        client.get(
            "/api/user",
            params={"user_id": "rotation-api-user"},
            auth=httpx.BasicAuth("rotation-api-user", new_refresh_token),
        ).status_code
        == 200
    )
    assert (
        client.get(
            "/api/user",
            params={"user_id": "rotation-api-user"},
            auth=httpx.BasicAuth("rotation-api-user", old_refresh_token),
        ).status_code
        == 401
    )


def test_refresh_token_without_rotation_preserves_existing_token(
    client: TestClient,
):
    user, _ = setup_user(client)
    users = app.dependency_overrides[get_users_table]()
    original_hash = users.get(
        lambda value: value["user_id"] == user["user_id"]
    )["refresh_token_hash"]
    with mock.patch(
        "internal.app.routes.api_routes.get_access_token",
        return_value={
            "access_token": "access-token",
            "token_type": "Bearer",
            "expires_in": 3600,
        },
    ):
        response = client.post(
            "/api/refresh_token",
            json={"refresh_token": "rt_123"},
        )

    assert response.status_code == 202
    assert "refresh_token" not in response.json()
    stored_user = users.get(lambda value: value["user_id"] == user["user_id"])
    assert stored_user["refresh_token"] == "rt_123"
    assert stored_user["refresh_token_hash"] == original_hash


def test_refresh_token_spotify_error_is_not_success_or_secret_leak(
    client: TestClient,
    caplog,
):
    secret = "secret-refresh-token"
    with mock.patch(
        "internal.app.routes.api_routes.get_access_token",
        side_effect=SpotifyTokenError(400, "invalid_grant"),
    ):
        response = client.post(
            "/api/refresh_token",
            json={"refresh_token": secret},
        )

    assert response.status_code == 400
    assert "secret-refresh-token" not in response.text
    assert secret not in caplog.text


def test_create_user_ok(client: TestClient):
    u, resp = setup_user(client)
    assert resp.status_code == 200
    assert u["user_id"] == "u123"
    assert u["is_premium"] is False


def test_create_user_duplicate(client: TestClient):
    _ = setup_user(client)
    _, resp = setup_user(client)
    assert resp.status_code == 400
    assert resp.json()["message"] == "User already exists"


def test_update_user_ok(client: TestClient):
    u, _ = setup_user(client)

    payload = {
        "send_mail": False,
        "email": "new@mail.com",
        "is_premium": True,
        "refresh_token": "rt_new",
        "dw_playlist_id": "pl_999",
        "tg_chat_id": "tg_999",
    }
    resp = client.put(
        "/api/update_user",
        params={"user_id": u["user_id"]},
        json=payload,
        auth=auth(u["user_id"]),
    )
    assert resp.status_code == 200
    for k in [
        "send_mail",
        "email",
        "is_premium",
        "dw_playlist_id",
        "tg_chat_id",
    ]:
        assert resp.json()[k] == payload[k]
    assert "refresh_token" not in resp.json()
    assert "refresh_token_hash" not in resp.json()


def test_update_user_not_found(client):
    resp = client.put(
        "/api/update_user",
        params={"user_id": "ghost"},
        json={"send_mail": True},
        auth=auth("ghost"),
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "User or refresh token not found"


def test_notify_user_ok(client: TestClient):
    u, _ = setup_user(client, tg_chat_id="tg_123")
    resp = client.post(
        "/api/test-notification",
        json={"tg_chat_id": "tg_123", "subject": "test", "text": "test"},
        auth=auth(u["user_id"]),
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "notification has been sent"


def test_notification_requires_authentication(client: TestClient):
    response = client.post(
        "/api/test-notification",
        json={"tg_chat_id": "tg_123", "subject": "test", "text": "test"},
    )

    assert response.status_code == 401


def test_user_cannot_notify_another_users_chat(client: TestClient):
    setup_user(client, tg_chat_id="tg_123")
    client.post(
        "/api/new_user",
        json={
            "user_id": "other-user",
            "is_premium": False,
            "refresh_token": "other-token",
            "refresh_token_hash": "other-pass",
            "tg_chat_id": "tg_other",
        },
    )

    response = client.post(
        "/api/test-notification",
        json={"tg_chat_id": "tg_other", "subject": "test", "text": "test"},
        auth=auth("u123"),
    )

    assert response.status_code == 403


def test_update_user_custome_description(client: TestClient):
    pl_name = "test_pattern_{year}_{month}_{day}"
    pl_desc = "test_pattern_desc_{year}_{month}_{day}"

    u, _ = setup_user(
        client,
        custom_pl_name_pattern=pl_name,
        custom_pl_description_pattern=pl_desc,
    )
    resp = client.put(
        "/api/update_user",
        params={"user_id": u["user_id"]},
        json={
            "custom_pl_name_pattern": pl_name,
            "custom_pl_description_pattern": pl_desc,
        },
        auth=auth(u["user_id"]),
    )
    assert resp.status_code == 200
    assert resp.json()["custom_pl_name_pattern"] == pl_name
    assert resp.json()["custom_pl_description_pattern"] == pl_desc


def test_user_cannot_read_another_users_record(client: TestClient):
    setup_user(client)
    client.post(
        "/api/new_user",
        json={
            "user_id": "other-user",
            "is_premium": False,
            "refresh_token": "other-token",
            "refresh_token_hash": "other-pass",
        },
    )

    response = client.get(
        "/api/user",
        params={"user_id": "other-user"},
        auth=auth("u123"),
    )

    assert response.status_code == 403


def test_user_cannot_update_another_users_record(client: TestClient):
    setup_user(client)
    client.post(
        "/api/new_user",
        json={
            "user_id": "other-user",
            "is_premium": False,
            "refresh_token": "other-token",
            "refresh_token_hash": "other-pass",
        },
    )

    response = client.put(
        "/api/update_user",
        params={"user_id": "other-user"},
        json={"email": "hijacked@example.com"},
        auth=auth("u123"),
    )

    assert response.status_code == 403


def test_user_responses_never_expose_refresh_tokens(client: TestClient):
    created, create_response = setup_user(client)
    fetched = client.get(
        "/api/user",
        params={"user_id": created["user_id"]},
        auth=auth(created["user_id"]),
    )
    updated = client.put(
        "/api/update_user",
        params={"user_id": created["user_id"]},
        json={"email": "safe@example.com"},
        auth=auth(created["user_id"]),
    )

    for response in (create_response, fetched, updated):
        assert response.status_code == 200
        assert "refresh_token" not in response.json()
        assert "refresh_token_hash" not in response.json()
