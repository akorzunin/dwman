import os

from dotenv import load_dotenv

load_dotenv()

_true_values = ("True", "true", "1")

TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN")
TG_LIVE_TEST = os.getenv("TG_LIVE_TEST", "False") in _true_values
TG_LIVE_TEST_CHAT_ID = os.getenv("TG_LIVE_TEST_CHAT_ID")
