import asyncio
from typing import Literal

import structlog
from backend.app import crud, shemas
from backend.app.auth import check_credentials, security
from backend.app.db_connector import users
from backend.app.mail_handle import render_notification_text, send_email
from backend.app.task_handler import (
    manage_user_tasks,
    send_notification,
    send_notifications_task,
)
from backend.app.utils import get_access_token
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBasicCredentials

router = APIRouter(
    prefix="/api",
    tags=["API"],
)

logger = structlog.stdlib.get_logger(__name__)


@router.post(
    "/refresh_token",
    response_model=shemas.SpotifyToken | shemas.SpotifyError,
    status_code=status.HTTP_202_ACCEPTED,
)
async def refresh_token(
    refresh_token: shemas.RefreshToken,
):
    res = dict(get_access_token(refresh_token.refresh_token))
    # TODO return error if model is SpotifyError
    return res


### Mail routes
@router.post(
    "/send_mail",
    status_code=status.HTTP_200_OK,
)
async def send_mail(user_email: shemas.UserEmail):
    """Send mail to user"""
    asyncio.gather(
        send_email(
            email=user_email.email,
            subject=user_email.subject,
            mail_text=user_email.text,
        )
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "email has been sent"},
    )


@router.post("/test_save_email")
async def test_save_email(user_email: shemas.UserEmail):
    """Test save email"""
    user = crud.get_user_by_email(users, user_email.email)
    # task = user_notify_task(user)
    send_notification(
        user_email.email,
        text=render_notification_text(
            user.dw_playlist_id,
            user.user_id,
        ),
    )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "email has been sent"},
    )


### Db routes
@router.get(
    "/users",
    response_model=list[shemas.User],
)
async def get_users(
    credentials: HTTPBasicCredentials = Depends(security),
):
    """Get all users from database"""
    check_credentials(credentials)
    return crud.get_all_users(users)


@router.get(
    "/user",
    status_code=status.HTTP_200_OK,
    responses={
        # status.HTTP_200_OK: {"model": shemas.User},
        status.HTTP_404_NOT_FOUND: {"model": shemas.Message},
    },
    # response_model=shemas.User,
)
async def get_user(user_id: str):
    """Get user by user_id"""
    if user := crud.get_user(users, user_id):
        return user
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"message": "User not found"},
    )


@router.post(
    "/new_user",
    response_model=shemas.User,
    responses={status.HTTP_400_BAD_REQUEST: {"model": shemas.Message}},
)
async def create_user(user: shemas.CreateUser):
    """Create new user"""
    if created_user := crud.create_user(users, user):
        return created_user
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"message": "User already exists"},
    )


@router.put(
    "/update_user",
    response_model=shemas.User,
    responses={
        status.HTTP_404_NOT_FOUND: {"model": shemas.Message},
    },
)
async def update_user(user: shemas.UpdateUser, user_id: str):
    """Update user"""
    if updated_user := crud.update_user(users, user, user_id):
        if message := manage_user_tasks(updated_user):
            logger.warning(message.model_dump())
        return updated_user
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"message": "User not found"},
    )


@router.delete(
    "/delete_user",
    responses={
        status.HTTP_200_OK: {"model": shemas.Message},
        status.HTTP_202_ACCEPTED: {"model": shemas.Message},
    },
)
async def delete_user(
    user_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
):
    """Delete user by id"""
    check_credentials(credentials)
    if _ := crud.delete_user(users, user_id):
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": "User deleted"},
        )
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"message": "User does not exists"},
    )


@router.post("/force_notifications_task")
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
