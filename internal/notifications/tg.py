import requests
import structlog
from backend.settings import TG_BOT_TOKEN

log = structlog.stdlib.get_logger(__name__)


def send_telegram_notification(chat_id: str, message: str):
    url = f"https://api.telegram.org/bot{TG_BOT_TOKEN}/sendMessage"
    data = {"chat_id": chat_id, "text": message}
    try:
        response = requests.post(url, data=data)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        log.exception(e)
        return e
    return None
