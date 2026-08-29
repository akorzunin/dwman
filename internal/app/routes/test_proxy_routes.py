from unittest.mock import AsyncMock, patch

import httpx
from fastapi.testclient import TestClient


def test_proxy_does_not_forward_unsupported_content_encoding(
    client: TestClient,
):
    async def spotify_response(request: httpx.Request):
        assert "zstd" not in request.headers.get("accept-encoding", "")
        return httpx.Response(200, json={"ok": True}, request=request)

    with patch(
        "internal.app.routes.proxy_routes.spotify_client.send",
        new=AsyncMock(side_effect=spotify_response),
    ):
        response = client.get(
            "/api/spotify/v1/me",
            headers={"Accept-Encoding": "gzip, deflate, br, zstd"},
        )

    assert response.json() == {"ok": True}
