from fastapi import APIRouter, Request, Response
from httpx import AsyncClient

spotify_client = AsyncClient(base_url="https://api.spotify.com")
allowed_headers = (
    "accept",
    "content-type",
    "authorization",
    "user-agent",
    "accept-encoding",
)

router = APIRouter(tags=["proxy API"])


@router.api_route("/api/spotify/{path:path}", methods=["GET", "POST"])
async def spotify_request(path: str, request: Request, response: Response):
    headers = {
        x: request.headers[x]
        for x in request.headers.keys()
        if x in allowed_headers
    }
    spotify_req = spotify_client.build_request(
        request.method,
        path,
        headers=headers,
        content=await request.body(),
    )
    spotify_res = await spotify_client.send(spotify_req)

    response.body = spotify_res.content
    response.status_code = spotify_res.status_code

    return response
