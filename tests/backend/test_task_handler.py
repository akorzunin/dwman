from unittest import mock

import pytest
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

from backend.app import shemas
from backend.app.crud import create_user
from src.backend.app.task_handler import send_notifications_task


@pytest.fixture
def mock_user_table():
    db = TinyDB(storage=MemoryStorage)
    users = db.table("users")
    with mock.patch(
        "src.backend.app.task_handler.users",
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
            send_time="1973-01-07 14:00:00+00:00",
            is_premium=False,
            refresh_token="test_refresh_token",
        ),
    )


@pytest.mark.asyncio
async def test_send_notifications_task(setup_user: shemas.User):
    time_overrides = {
        "weekday": 6,
        "hour": 14,  # UTC
        "minute": 45,
    }
    res = await send_notifications_task(time_overrides)
    assert res["total_users"] == 1
    assert res["notified_users"] == [setup_user.user_id]
    weekday, time = res["curr_date"].split(" ")
    assert weekday == "6"
    assert time.startswith("14:")
