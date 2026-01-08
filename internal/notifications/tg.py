import requests
import structlog

from internal.settings import TG_BOT_TOKEN

log = structlog.stdlib.get_logger(__name__)


def send_telegram_notification(chat_id: str | None, message: str):
    if not chat_id:
        raise ValueError("Chat id is not set")
    if not TG_BOT_TOKEN:
        raise ValueError("Telegram bot token is not set")

    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    data = {"chat_id": chat_id, "text": message}
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        log.exception(str(e))
        return e
    return None
