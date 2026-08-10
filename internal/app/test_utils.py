from unittest import mock

import pytest

from internal.app.utils import SpotifyTokenError, get_access_token


def spotify_response(payload: dict, status_code: int = 200):
    response = mock.Mock()
    response.status_code = status_code
    response.json.return_value = payload
    return response


def test_get_access_token_accepts_rotated_refresh_token():
    payload = {
        "access_token": "access",
        "token_type": "Bearer",
        "expires_in": 3600,
        "refresh_token": "new-refresh",
    }
    with mock.patch(
        "internal.app.utils.requests.post",
        return_value=spotify_response(payload),
    ):
        assert get_access_token("old-refresh") == payload


def test_get_access_token_preserves_response_without_rotation():
    payload = {
        "access_token": "access",
        "token_type": "Bearer",
        "expires_in": 3600,
    }
    with mock.patch(
        "internal.app.utils.requests.post",
        return_value=spotify_response(payload),
    ):
        result = get_access_token("old-refresh")

    assert "refresh_token" not in result


def test_get_access_token_rejects_spotify_error():
    with mock.patch(
        "internal.app.utils.requests.post",
        return_value=spotify_response(
            {
                "error": "invalid_grant",
                "error_description": "Invalid refresh token",
            },
            status_code=400,
        ),
    ):
        with pytest.raises(SpotifyTokenError) as error:
            get_access_token("secret-refresh")

    assert error.value.status_code == 400
    assert "secret-refresh" not in str(error.value)
