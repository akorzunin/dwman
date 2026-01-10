import httpx
from fastapi.testclient import TestClient

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
        "refresh_token",
        "dw_playlist_id",
        "tg_chat_id",
    ]:
        assert resp.json()[k] == payload[k]


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
