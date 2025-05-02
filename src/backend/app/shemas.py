from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator


class RefreshToken(BaseModel):
    refresh_token: str


class SpotifyToken(BaseModel):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int


class SpotifyError(BaseModel):
    error: str
    error_description: str


class BaseUser(BaseModel):
    dw_playlist_id: str | None = None
    save_dw_weekly: bool = False
    save_full_playlist: bool = False
    filter_dislikes: bool = True


class User(BaseUser):
    user_id: str
    created_at: str
    send_mail: bool = False
    email: Optional[EmailStr | Literal[""]]
    send_time: Optional[str]
    is_premium: bool
    refresh_token: str
    save_time: Optional[str]

    @field_validator("send_time", "save_time", "created_at", mode="before")
    def parse_birthdate(cls, value):
        if value:
            if isinstance(value, str):
                return value
            assert isinstance(value, datetime)
            return str(value)


class CreateUser(BaseUser):
    user_id: str
    send_mail: bool = False
    email: EmailStr | None = None
    send_time: datetime | None = None
    is_premium: bool
    refresh_token: str
    save_time: datetime | None = None


class UpdateUser(BaseModel):
    send_mail: bool | None = None
    email: EmailStr | Literal[""] | None = None
    send_time: datetime | Literal[""] | None = None
    is_premium: bool | None = None
    refresh_token: str | None = None
    save_time: datetime | Literal[""] | None = None
    dw_playlist_id: str | None = None
    save_dw_weekly: bool | None = None
    save_full_playlist: bool | None = None
    filter_dislikes: bool | None = None

    @field_validator("send_time", "save_time", mode="after")
    def parse_date(cls, value):
        if value:
            return str(value)
        return ""


class UserEmail(BaseModel):
    email: EmailStr
    subject: str
    text: str


class Message(BaseModel):
    message: str


class NotifyUser(BaseModel):
    user_id: str
    email: EmailStr
    send_time: datetime
    dw_playlist_id: str


class SavePlUser(BaseModel):
    user_id: str
    email: EmailStr
    save_time: datetime
    send_mail: bool
    dw_playlist_id: str
    refresh_token: str
    filter_dislikes: bool
    save_full_playlist: bool
