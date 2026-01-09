from fastapi.testclient import TestClient


def setup_user(client: TestClient, **kw):
    resp = client.post(
        "/api/new_user",
        json=dict(
            user_id="u123",
            is_premium=False,
            refresh_token="rt_123",
            **kw,
        ),
    )
    return resp


def test_create_user_ok(client: TestClient):
    resp = setup_user(client)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == "u123"
    assert data["is_premium"] is False


def test_create_user_duplicate(client: TestClient):
    _ = setup_user(client)
    resp = setup_user(client)
    assert resp.status_code == 400
    assert resp.json()["message"] == "User already exists"


def test_update_user_ok(client: TestClient):
    u_resp = setup_user(client)

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
        params={"user_id": u_resp.json()["user_id"]},
        json=payload,
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
    )
    assert resp.status_code == 400
    assert resp.json()["message"] == "User not found"


def test_notify_user_ok(client: TestClient):
    _ = setup_user(client, tg_chat_id="tg_123")
    resp = client.post(
        "/api/test-notification",
        json={"tg_chat_id": "tg_123", "subject": "test", "text": "test"},
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "notification has been sent"


def test_update_user_custome_description(client: TestClient):
    p = "test_pattern_{year}_{month}_{day}"

    u = setup_user(client, custom_description_pattern=p).json()
    resp = client.put(
        "/api/update_user",
        params={"user_id": u["user_id"]},
        json={"custom_description_pattern": p},
    )
    assert resp.status_code == 200
    assert resp.json()["custom_description_pattern"] == p
