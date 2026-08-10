import asyncio
from copy import copy
from datetime import datetime, timezone
from typing import Literal, Optional

import schedule
import spotipy
import structlog
from pydantic import ValidationError
from tinydb import where

from internal.app import crud, shemas
from internal.app.db_connector import users
from internal.app.dw_save_algoritm import get_pl_name, save_playlist_algorithm
from internal.app.mail_handle import (
    render_notification_text,
    render_save_pl_text,
    send_email,
)
from internal.app.utils import SpotifyTokenError, get_access_token
from internal.notifications.tg import send_telegram_notification
from internal.settings import DEPLOY_URL

logger = structlog.stdlib.get_logger(__name__)


async def task_tick():
    schedule.run_pending()


async def send_notifications_task(time_overrides: dict | None = None):
    dt = datetime.now(timezone.utc)
    curr_weekday = dt.weekday()
    curr_hour = dt.hour
    curr_minute = dt.minute
    if time_overrides:
        curr_weekday = time_overrides["weekday"]
        curr_hour = time_overrides["hour"]
        curr_minute = time_overrides["minute"]
    users_to_nofify = users.search(where("send_mail") == True)
    notified_users = []
    for db_user in users_to_nofify:
        try:
            user = shemas.User(**db_user)
            if not user.send_time:
                raise ValueError("User send_time is not set")
            send_time = datetime.strptime(user.send_time, "%Y-%m-%d %H:%M:%S%z")

            if (
                curr_weekday == send_time.weekday()
                and curr_hour == send_time.hour
            ):
                await send_notification(user)
                notified_users.append(user.user_id)
        except Exception as e:
            logger.exception(
                f"Error while sending notification to {user.email}: {e}",
                user_id=user.user_id,
            )
    return {
        "total_users": len(users_to_nofify),
        "notified_users": notified_users,
        "date": f"{dt.weekday()} {dt.hour:0>2.0f}:{dt.minute:0>2.0f}",
        "curr_date": f"{curr_weekday} {curr_hour:0>2.0f}:{curr_minute:0>2.0f}",
    }


async def async_task_tick():
    while 1:
        schedule.run_pending()
        await asyncio.sleep(1)


def parse_task_time(send_time: str | datetime) -> tuple[int, str]:
    # Convert given time to local
    if isinstance(send_time, str):
        send_time = datetime.strptime(send_time, "%Y-%m-%d %H:%M:%S%z")
    server_send_time = send_time.astimezone(None)
    return (
        send_time.weekday(),
        f"{server_send_time.hour:0>2.0f}:{server_send_time.minute:0>2.0f}",
    )


def revive_user_tasks():
    """Restore tasks from db after program restart"""
    notify_users = users.search(~(where("send_time").one_of([None, ""])))
    for user in notify_users:
        try:
            nt_user = shemas.NotifyUser(**user)
        except ValidationError as e:
            logger.exception(
                f"Error while creating notify task: {e}",
                user_id=user["user_id"],
            )
            continue
        task = user_notify_task(nt_user)
        logger.info(
            f"[Notify Task created] Next run: {str(task.next_run)} "
            f"User: {user['user_id']}"
        )


def manage_user_tasks(user: shemas.User) -> Optional[shemas.Message]:
    """Create or cancel notification tasks for a user."""
    if not user.send_mail:
        schedule.clear(get_tag(user.user_id, "notify"))

    if user.send_mail and schedule.get_jobs(
        get_tag(user.user_id, "notify"),
    ):
        # create notify task if task is not exists
        task = user_notify_task(user)  # type: ignore
        logger.info(
            f"[New Notify Task] Next run: {str(task.next_run)} "
            f"User: {user.user_id}"
        )
    return None


def get_tag(user_id: str, task_type: Literal["notify"]):
    """Generate unique tag for each task"""
    return f"{user_id}_{task_type}"


def get_weekday_task(weekday: int):
    weekday_task = (
        schedule.every().monday,
        schedule.every().tuesday,
        schedule.every().wednesday,
        schedule.every().thursday,
        schedule.every().friday,
        schedule.every().saturday,
        schedule.every().sunday,
    )
    return copy(weekday_task[weekday])


def user_notify_task(user: shemas.NotifyUser) -> schedule.Job:
    weekday, shedule_time = parse_task_time(user.send_time)
    return (
        get_weekday_task(weekday)
        .at(shedule_time)
        .do(
            send_notification,
            email=user.email,
            text=render_notification_text(
                user.dw_playlist_id,
                user.user_id,
            ),
        )
        .tag(get_tag(user.user_id, "notify"))
    )


### ACTUAL TASKS ###


async def send_notification(user: shemas.User):
    logger.info(
        f"Sending notification to {user.user_id} at {datetime.now(timezone.utc)}"
    )
    msg = f"""
Save Discover Weekly Playlist {get_pl_name(user.user_id)}

dwman: {DEPLOY_URL}
"""
    if user.tg_chat_id:
        msg += f"playlist link: https://open.spotify.com/playlist/{user.dw_playlist_id}"
    err = send_telegram_notification(user.tg_chat_id, msg)
    if err is not None:
        logger.error(err)


async def save_dw(user: shemas.SavePlUser):
    if not user.refresh_token:
        logger.warning("No refresh token for user", user_id=user.user_id)
        return
    try:
        user_data = get_access_token(user.refresh_token)
    except SpotifyTokenError as exc:
        logger.warning(
            "Spotify token refresh failed while saving playlist",
            user_id=user.user_id,
            spotify_status=exc.status_code,
            spotify_error=exc.error,
        )
        return

    if (
        not isinstance(user_data, dict)
        or user_data.get("error")
        or not user_data.get("access_token")
    ):
        spotify_error = (
            user_data.get("error", "invalid_response")
            if isinstance(user_data, dict)
            else "invalid_response"
        )
        logger.warning(
            "Spotify returned an invalid token response while saving playlist",
            user_id=user.user_id,
            spotify_error=spotify_error,
        )
        return

    if new_refresh_token := user_data.get("refresh_token"):
        try:
            crud.update_refresh_token(users, user.user_id, new_refresh_token)
        except Exception as exc:
            logger.error(
                "Could not persist rotated Spotify refresh token",
                user_id=user.user_id,
                error=type(exc).__name__,
            )
            return

    token = user_data["access_token"]
    sp = spotipy.Spotify(auth=token)
    # TODO: figure out why i didnt call this function
    # sp.user_playlist_create
    await save_playlist_algorithm(sp, user)

    if user.send_mail:
        # TODO add separate filed to form and shema to send mails on pl save
        subject = "Discover Weekly Playlist Saved"
        text = render_save_pl_text(user.dw_playlist_id, user.user_id)
        logger.info(
            f"Sending save_dw mail to {user.email} at {datetime.now(timezone.utc)}"
        )
        await send_email(user.email, subject, text)
