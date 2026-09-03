from typing import Annotated, Literal

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from internal.app import crud, shemas
from internal.app.auth import (
    check_credentials,
    check_user_credentials,
)
from internal.app.db_connector import UsersTable
from internal.app.task_handler import (
    manage_user_tasks,
    send_notification,
    send_notifications_task,
)
from internal.app.utils import SpotifyTokenError, get_access_token

router = APIRouter(
    prefix="/api",
    tags=["API"],
)


user_router = APIRouter(
    prefix="/api",
    tags=["User"],
)

AuthenticatedUser = Annotated[shemas.User, Depends(check_user_credentials)]


def enforce_self_access(
    requested_user_id: str, authenticated_user: shemas.User
) -> None:
    if requested_user_id != authenticated_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access another user",
        )


logger = structlog.stdlib.get_logger(__name__)


@router.post(
    "/refresh_token",
    response_model=shemas.SpotifyToken,
    response_model_exclude_none=True,
    status_code=status.HTTP_202_ACCEPTED,
)
async def refresh_token(
    refresh_token: shemas.RefreshToken,
    users: UsersTable,
):
    try:
        res = get_access_token(refresh_token.refresh_token)
    except SpotifyTokenError as exc:
        logger.warning(
            "Spotify token refresh failed",
            spotify_status=exc.status_code,
            spotify_error=exc.error,
        )
        error_status = (
            exc.status_code
            if 400 <= exc.status_code < 500
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(
            status_code=error_status,
            detail="Spotify token refresh failed",
        ) from None

    # Keep this guard for callers/tests that replace get_access_token directly.
    if (
        not isinstance(res, dict)
        or res.get("error")
        or not {"access_token", "token_type", "expires_in"}.issubset(res)
    ):
        spotify_error = (
            res.get("error", "invalid_response")
            if isinstance(res, dict)
            else "invalid_response"
        )
        logger.warning(
            "Spotify returned an invalid token response",
            spotify_error=spotify_error,
        )
        error_status = (
            status.HTTP_400_BAD_REQUEST
            if isinstance(res, dict) and res.get("error")
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(
            status_code=error_status,
            detail="Spotify token refresh failed",
        )

    if new_refresh_token := res.get("refresh_token"):
        user = crud.get_user_by_refresh_token(
            users, refresh_token.refresh_token
        )
        if user is None:
            logger.warning("Rotated Spotify refresh token has no matching user")
        else:
            try:
                crud.update_refresh_token(
                    users,
                    user.user_id,
                    new_refresh_token,
                )
            except Exception as exc:
                logger.error(
                    "Could not persist rotated Spotify refresh token",
                    user_id=user.user_id,
                    error=type(exc).__name__,
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not persist refreshed token",
                ) from None
    return res


class UserEmail(BaseModel):
    subject: str
    text: str
    tg_chat_id: str


@router.post(
    "/new_user",
    response_model=shemas.PublicUser,
    responses={status.HTTP_400_BAD_REQUEST: {"model": shemas.Message}},
)
async def create_user(user: shemas.CreateUser, users: UsersTable):
    """Create new user"""
    try:
        return crud.create_user(users, user)
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"message": str(e)},
        )


@user_router.post("/test-notification")
async def test_notification(
    msg: UserEmail,
    users: UsersTable,
    authenticated_user: AuthenticatedUser,
):
    """Send a test notification for the authenticated user."""
    if msg.tg_chat_id != authenticated_user.tg_chat_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot notify another user",
        )
    try:
        user = crud.get_user_by_tg_chat_id(users, msg.tg_chat_id)
    except Exception as e:
        logger.exception(str(e))
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"message": "User not found"},
        )
    await send_notification(user)
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "notification has been sent"},
    )


@user_router.get(
    "/user",
    status_code=status.HTTP_200_OK,
    responses={
        # status.HTTP_200_OK: {"model": shemas.User},
        status.HTTP_404_NOT_FOUND: {"model": shemas.Message},
    },
    response_model=shemas.PublicUser,
)
async def get_user(
    user_id: str,
    users: UsersTable,
    authenticated_user: AuthenticatedUser,
):
    """Get the authenticated user's data."""
    enforce_self_access(user_id, authenticated_user)
    if user := crud.get_user(users, user_id):
        return user
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"message": "User not found"},
    )


@user_router.put(
    "/update_user",
    response_model=shemas.PublicUser,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": shemas.Message},
    },
)
async def update_user(
    user: shemas.UpdateUser,
    user_id: str,
    users: UsersTable,
    authenticated_user: AuthenticatedUser,
):
    """Update the authenticated user."""
    enforce_self_access(user_id, authenticated_user)
    try:
        updated_user = crud.update_user(users, user, user_id)
        if not updated_user:
            raise ValueError("User not found")
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"message": str(e)},
        )
    if message := manage_user_tasks(updated_user):
        logger.warning(str(message.model_dump()))
    return updated_user


admin_router = APIRouter(
    prefix="/api",
    tags=["Admin"],
    dependencies=[Depends(check_credentials)],
)


@admin_router.get(
    "/users",
    response_model=list[shemas.PublicUser],
)
async def get_users(users: UsersTable):
    """Get all users from database"""
    return crud.get_all_users(users)


@admin_router.delete(
    "/delete_user",
    responses={
        status.HTTP_200_OK: {"model": shemas.Message},
        status.HTTP_202_ACCEPTED: {"model": shemas.Message},
    },
)
async def delete_user(
    user_id: str,
    users: UsersTable,
):
    """Delete user by id"""
    if _ := crud.delete_user(users, user_id):
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": "User deleted"},
        )
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"message": "User does not exists"},
    )


@admin_router.post("/force_notifications_task")
async def force_notifications_task(
    weekday: Literal["0", "1", "2", "3", "4", "5", "6"] | None = None,
    hour: int | None = None,
):
    """Send notifications task"""
    time_overrides = {}
    if weekday is not None and hour is not None:
        time_overrides["weekday"] = int(weekday)
        time_overrides["hour"] = hour
        # time_overrides["minute"] = minute
    res = await send_notifications_task(time_overrides)
    return {
        "message": "ok",
        **res,
    }
