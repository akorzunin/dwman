import os
from datetime import datetime
from random import randint
from typing import Literal
from urllib.parse import urlencode

import requests
import spotipy
import structlog  # type: ignore
from fastapi import APIRouter, Request, status
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

### pydantic
from pydantic import BaseModel

from configs.scope import scope_str

logger = structlog.stdlib.get_logger(__name__)


class UserData(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: str
    scope: str


###
REDIRECT_URI: str = os.environ["SPOTIPY_REDIRECT_URL"]
templates = Jinja2Templates(directory="src/frontend/templates")

router = APIRouter(tags=["Frontend"])


@router.get("/")
async def root():
    return RedirectResponse("/app")


@router.get("/favicon.ico")
async def favicon():
    return FileResponse("./src/frontend/dist/assets/play-arrow-BOYszNJp.png")


@router.get("/app/{_:path}")
async def react_path():
    return FileResponse("./src/frontend/dist/index.html")


@router.get(
    "/user/{user_id}",
    response_class=HTMLResponse,
    status_code=status.HTTP_300_MULTIPLE_CHOICES,
)
async def user_page(request: Request, user_id: str):
    """Redirect to react hash router user page"""
    return RedirectResponse(f"/#/user/{user_id}")


def new_state() -> str:
    """Generate state for auth code flow"""
    return "".join(chr(randint(33, 126)) for i in range(16))


def get_redirect_url(referer: str | None) -> str:
    if not referer:
        return REDIRECT_URI
    method, url = referer.split("//")
    redirect_uri = method + "//" + url.split("/")[0]
    return f"{redirect_uri}/get_token"


@router.get(
    "/login",
    response_class=HTMLResponse,
    status_code=status.HTTP_300_MULTIPLE_CHOICES,
)
async def login_url(
    req: Request,
    state: str = new_state(),
    show_dialog: Literal["true", "false"] = "false",
):
    """Redirect to Spotify login page"""
    redirect_uri = get_redirect_url(req.headers.get("Referer"))
    logger.info(f"Redirecting to login page from {redirect_uri}")
    r = requests.Request(
        "GET",
        "https://accounts.spotify.com/en/authorize?"
        + urlencode(
            dict(
                response_type="code",
                client_id=os.getenv("SPOTIPY_CLIENT_ID"),
                scope=scope_str,
                redirect_uri=redirect_uri,
                state=state,
                show_dialog=show_dialog,
            )
        ),
    )
    return RedirectResponse(r.prepare().url)


@router.get(
    "/{region}/login",
    status_code=status.HTTP_300_MULTIPLE_CHOICES,
)
async def login_redirect(
    region: str,
):
    return RedirectResponse("/login")


@router.get(
    "/get_token",
    status_code=status.HTTP_300_MULTIPLE_CHOICES,
)
async def get_token(req: Request, code: str, redirect: bool = True):
    redirect_uri = get_redirect_url(req.headers.get("Referer"))
    r = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": os.getenv("SPOTIPY_CLIENT_ID"),
            "client_secret": os.getenv("SPOTIPY_CLIENT_SECRET"),
        },
    ).json()
    logger.info(f"REDIRECT {redirect_uri}")
    token_data = dict(r) | {"get_time": str(datetime.now())}
    sp = spotipy.Spotify(auth=token_data["access_token"])
    user_id = sp.current_user()["id"]
    if not redirect:
        # NOTE request w/o redirect only user for vite dev server
        token_data |= {"user_id": user_id}
        logger.info("SENDING token_data")
        return token_data
    res = RedirectResponse(f"/app/user/{user_id}")
    for k, v in token_data.items():
        res.set_cookie(k, v)
    logger.info("SENDING redirect response")
    return res
