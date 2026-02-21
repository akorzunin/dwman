import os
import sys

from dotenv import load_dotenv

load_dotenv()

_true_values = ("True", "true", "1")

UVICORN_PORT = int(os.getenv("UVICORN_PORT", "8000"))

IGNORE_CORS = os.getenv("IGNORE_CORS", "False") in _true_values
JSON_LOGS = os.getenv("JSON_LOGS", str(not sys.stdout.isatty())) in _true_values
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

SPOTIPY_REDIRECT_URL: str = os.environ["SPOTIPY_REDIRECT_URL"]
SPOTIPY_CLIENT_ID: str = os.environ["SPOTIPY_CLIENT_ID"]
SPOTIPY_CLIENT_SECRET: str = os.environ["SPOTIPY_CLIENT_SECRET"]

API_LOGIN = os.getenv("API_LOGIN", "admin")
API_PASSWORD = os.getenv("API_PASSWORD", "admin")

TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN")
TG_LIVE_TEST = os.getenv("TG_LIVE_TEST", "False") in _true_values
TG_LIVE_TEST_CHAT_ID = os.getenv("TG_LIVE_TEST_CHAT_ID")

DEPLOY_URL = os.getenv("DEPLOY_URL", "https://dwman.akorz-nt1.duckdns.org")
