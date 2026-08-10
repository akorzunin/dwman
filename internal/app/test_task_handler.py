from unittest import mock

import bcrypt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPBasicCredentials
from tinydb import TinyDB, where
from tinydb.storages import MemoryStorage

from internal.app import shemas
from internal.app.auth import check_user_credentials
from internal.app.crud import create_user
from internal.app.task_handler import save_dw, send_notifications_task
from internal.settings import TG_LIVE_TEST, TG_LIVE_TEST_CHAT_ID


@pytest.fixture
def mock_user_table():
    db = TinyDB(storage=MemoryStorage)
    users = db.table("users")
    with mock.patch(
        "internal.app.task_handler.users",
        new=users,
    ) as users_table:
        yield users_table


@pytest.fixture
def setup_user(mock_user_table):
    return create_user(
        mock_user_table,
        shemas.CreateUser(
            user_id="test_user",
            email="test@test.com",
            send_mail=True,
            send_time="1973-01-07 14:00:00+00:00",  # type: ignore
            is_premium=False,
            refresh_token="test_refresh_token",
            refresh_token_hash="somepass",
            tg_chat_id=TG_LIVE_TEST_CHAT_ID if TG_LIVE_TEST else "123123123",
        ),
    )


@pytest.mark.asyncio
async def test_save_dw_persists_rotated_refresh_token(mock_user_table):
    old_refresh_token = "old-refresh-token"
    new_refresh_token = "new-refresh-token"
    create_user(
        mock_user_table,
        shemas.CreateUser(
            user_id="rotation_user",
            is_premium=False,
            refresh_token=old_refresh_token,
            refresh_token_hash=old_refresh_token,
        ),
    )
    user = shemas.SavePlUser(
        user_id="rotation_user",
        email="test@test.com",
        send_mail=False,
        dw_playlist_id="playlist",
        refresh_token=old_refresh_token,
        filter_dislikes=False,
        save_full_playlist=True,
    )

    with (
        mock.patch(
            "internal.app.task_handler.get_access_token",
            return_value={
                "access_token": "access-token",
                "token_type": "Bearer",
                "expires_in": 3600,
                "refresh_token": new_refresh_token,
            },
        ),
        mock.patch("internal.app.task_handler.spotipy.Spotify"),
        mock.patch(
            "internal.app.task_handler.save_playlist_algorithm",
            new=mock.AsyncMock(),
        ),
    ):
        await save_dw(user)

    stored_user = mock_user_table.get(where("user_id") == "rotation_user")
    assert stored_user["refresh_token"] == new_refresh_token
    assert bcrypt.checkpw(
        new_refresh_token.encode(),
        stored_user["refresh_token_hash"].encode(),
    )
    check_user_credentials(
        HTTPBasicCredentials(
            username="rotation_user", password=new_refresh_token
        ),
        mock_user_table,
    )
    with pytest.raises(HTTPException):
        check_user_credentials(
            HTTPBasicCredentials(
                username="rotation_user", password=old_refresh_token
            ),
            mock_user_table,
        )


@pytest.mark.asyncio
async def test_send_notifications_task(setup_user: shemas.User):
    time_overrides = {
        "weekday": 6,
        "hour": 14,  # UTC
        "minute": 45,
    }
    if TG_LIVE_TEST:
        res = await send_notifications_task(time_overrides)
    else:
        with mock.patch("requests.post"):
            res = await send_notifications_task(time_overrides)
    assert res["total_users"] == 1
    assert res["notified_users"] == [setup_user.user_id]
    weekday, time = res["curr_date"].split(" ")
    assert weekday == "6"
    assert time.startswith("14:")
