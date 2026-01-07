from unittest.mock import patch

import pytest

from internal.settings import TG_LIVE_TEST, TG_LIVE_TEST_CHAT_ID

from .tg import send_telegram_notification


@pytest.mark.skipif(not TG_LIVE_TEST, reason="Telegram live test is disabled")
def test_send_telegram_notification():
    message = "This is a test notification from your bot!"
    send_telegram_notification(TG_LIVE_TEST_CHAT_ID, message)


def test_send_telegram_notification_mocked():
    with patch("requests.post") as mock_post:
        send_telegram_notification(TG_LIVE_TEST_CHAT_ID, "test")
        mock_post.assert_called_once()
