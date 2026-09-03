import os
import subprocess
import sys


def test_admin_credentials_have_no_insecure_defaults():
    env = os.environ.copy()
    env.pop("API_LOGIN", None)
    env.pop("API_PASSWORD", None)
    env.update(
        SPOTIPY_REDIRECT_URL="http://localhost/get_token",
        SPOTIPY_CLIENT_ID="test",
        SPOTIPY_CLIENT_SECRET="test",
    )

    result = subprocess.run(
        [sys.executable, "-c", "import internal.settings"],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "API_LOGIN" in result.stderr or "API_PASSWORD" in result.stderr
