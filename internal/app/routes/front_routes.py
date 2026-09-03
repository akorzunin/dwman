import secrets
from datetime import datetime
from typing import Literal
from urllib.parse import urlencode

import requests
import spotipy
import structlog  # type: ignore
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse

### pydantic
from pydantic import BaseModel

from internal.app.utils import SpotifyTokenError, parse_spotify_token_response
from internal.scope import scope_str
from internal.settings import (
    SPOTIPY_CLIENT_ID,
    SPOTIPY_CLIENT_SECRET,
    SPOTIPY_REDIRECT_URL,
)

logger = structlog.stdlib.get_logger(__name__)


class UserData(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: str
    scope: str


router = APIRouter(tags=["Frontend"])


@router.get("/")
async def root():
    return RedirectResponse("/app")


@router.get("/favicon.ico")
async def favicon():
    return FileResponse("./web/dist/assets/play-arrow-BOYszNJp.png")


@router.get("/app/{_:path}")
async def react_path():
    return FileResponse("./web/dist/index.html")


@router.get(
    "/user/{user_id}",
    response_class=HTMLResponse,
    status_code=status.HTTP_300_MULTIPLE_CHOICES,
)
async def user_page(request: Request, user_id: str):
    """Redirect to react hash router user page"""
    return RedirectResponse(f"/#/user/{user_id}")


def new_state() -> str:
    """Generate an unpredictable OAuth state value."""
    return secrets.token_urlsafe(32)


def get_redirect_url() -> str:
    """Use the redirect URI registered with Spotify."""
    return SPOTIPY_REDIRECT_URL


@router.get(
    "/login",
    response_class=HTMLResponse,
    status_code=status.HTTP_300_MULTIPLE_CHOICES,
)
async def login_url(
    req: Request,
    state: str | None = None,
    show_dialog: Literal["true", "false"] = "false",
):
    """Redirect to Spotify login page"""
    # Never accept caller-selected state: it would defeat CSRF protection.
    state = new_state()
    redirect_uri = get_redirect_url()
    logger.info(f"Redirecting to login page from {redirect_uri}")
    r = requests.Request(
        "GET",
        "https://accounts.spotify.com/en/authorize?"
        + urlencode(
            dict(
                response_type="code",
                client_id=SPOTIPY_CLIENT_ID,
                scope=scope_str,
                redirect_uri=redirect_uri,
                state=state,
                show_dialog=show_dialog,
            )
        ),
    )
    url = r.prepare().url
    if not url:
        raise ValueError("Could not generate login url")
    response = RedirectResponse(url)
    response.set_cookie(
        "oauth_session",
        state,
        httponly=True,
        secure=redirect_uri.startswith("https://"),
        samesite="lax",
        max_age=600,
    )
    return response


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
async def get_token(
    req: Request,
    code: str,
    state: str | None = None,
    redirect: bool = True,
):
    expected_state = req.cookies.get("oauth_session")
    if (
        not state
        or not expected_state
        or not secrets.compare_digest(state, expected_state)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth state",
        )
    redirect_uri = get_redirect_url()
    try:
        response = requests.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": SPOTIPY_CLIENT_ID,
                "client_secret": SPOTIPY_CLIENT_SECRET,
            },
        )
        token_data = parse_spotify_token_response(response)
    except requests.RequestException:
        logger.warning("Spotify token exchange request failed")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Spotify token exchange failed",
        ) from None
    except SpotifyTokenError as exc:
        logger.warning(
            "Spotify token exchange failed",
            spotify_status=exc.status_code,
            spotify_error=exc.error,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Spotify token exchange failed",
        ) from None

    logger.info(f"REDIRECT {redirect_uri}")
    token_data = dict(token_data) | {"get_time": str(datetime.now())}
    sp = spotipy.Spotify(auth=token_data["access_token"])
    user_id = sp.current_user()["id"]
    if not redirect:
        # NOTE request w/o redirect only user for vite dev server
        token_data |= {"user_id": user_id}
        logger.info("SENDING token_data")
        return token_data
    res = RedirectResponse(f"/app/user/{user_id}")
    res.delete_cookie("oauth_session", path="/")
    secure = redirect_uri.startswith("https://")
    for k, v in token_data.items():
        # The current Spotify client reads these values in the browser.
        # A future BFF/session migration can make them HttpOnly.
        res.set_cookie(k, v, secure=secure, samesite="lax", path="/")
    logger.info("SENDING redirect response")
    return res
