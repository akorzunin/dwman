import asyncio
from copy import copy
from datetime import datetime, timezone
from typing import Literal, Optional

import schedule
import spotipy
import structlog
from pydantic import ValidationError
from tinydb import where

from backend.app import shemas
from backend.app.db_connector import users
from backend.app.dw_save_algoritm import save_playlist_algorithm
from backend.app.mail_handle import (
    render_notification_text,
    render_save_pl_text,
    send_email,
)
from backend.app.utils import get_access_token

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
            send_time = datetime.strptime(user.send_time, "%Y-%m-%d %H:%M:%S%z")

            if (
                curr_weekday == send_time.weekday()
                and curr_hour == send_time.hour
            ):
                await send_notification(
                    user.email,
                    text=render_notification_text(
                        user.dw_playlist_id,
                        user.user_id,
                    ),
                )
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


def user_save_task(user: shemas.SavePlUser):
    weekday, shedule_time = parse_task_time(user.save_time)
    return (
        get_weekday_task(weekday)
        .at(shedule_time)
        .do(
            save_dw,
            user=user,
        )
        .tag(get_tag(user.user_id, "save"))
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
    save_dw_users = users.search(where("save_dw_weekly") == True)
    for user in save_dw_users:
        try:
            u = shemas.SavePlUser(**user)
        except ValidationError as e:
            logger.exception(f"Error while creating save task: {e}")
            continue
        task = user_save_task(u)
        logger.info(
            f"[Save Task created] Next run: {str(task.next_run)} "
            f"User: {user['user_id']}"
        )


def manage_user_tasks(user: shemas.User) -> Optional[shemas.Message]:
    """Create or cancel tasks for a user on given data"""
    if not validate_user_task_data(user):
        return shemas.Message(message="Failed to create tasks for user")
    if not user.send_mail:
        # delete user notification task
        schedule.clear(get_tag(user.user_id, "notify"))
    if not user.save_dw_weekly:
        # delete user save task
        schedule.clear(get_tag(user.user_id, "save"))

    if user.send_mail and schedule.get_jobs(
        get_tag(user.user_id, "notify"),
    ):
        # create notify task if task is not exists
        task = user_notify_task(user)
        logger.info(
            f"[New Notify Task] Next run: {str(task.next_run)} "
            f"User: {user.user_id}"
        )
    if user.save_dw_weekly and schedule.get_jobs(
        get_tag(user.user_id, "save"),
    ):
        # create user save task if task is not exists
        task = user_save_task(user)
        logger.info(
            f"[New Save Task] Next run: {str(task.next_run)} "
            f"User: {user.user_id}"
        )
    return None


def get_tag(user_id: str, task_type: Literal["save", "notify"]):
    """Generate unique tag for each task"""
    return f"{user_id}_{task_type}"


def validate_user_task_data(user: shemas.User) -> bool:
    if not user.is_premium and user.filter_dislikes and user.save_dw_weekly:
        # cant use playback alg on non premium users
        return False
    if not user.save_dw_weekly:
        #  Dont need to save any
        return True
    if not user.filter_dislikes and user.save_full_playlist:
        # don't use playback alg and save all 30 songs from pl anyway
        return True
    if user.filter_dislikes:
        if not user.save_full_playlist:
            # use playback alg but if it returns all 30 songs don't save
            return True
        if user.save_full_playlist:
            # use playback alg but if it returns all 30 songs save pl anyway
            return True
    # invalid state
    return False


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


async def send_notification(email: str, text: str):
    subject = "Save Discover Weekly Playlist"
    logger.info(
        f"Sending notification to {email} at {datetime.now(timezone.utc)}"
    )
    await send_email(email, subject, text)


async def save_dw(user: shemas.SavePlUser):
    #  get sp somehow
    user_data = get_access_token(user.refresh_token)
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
