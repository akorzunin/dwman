from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, field_validator


class RefreshToken(BaseModel):
    refresh_token: str


class SpotifyToken(BaseModel):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    refresh_token: str | None = None


class SpotifyError(BaseModel):
    error: str
    error_description: str


# New optional fields for user
# TODO: probably whole module needs to be refactored but for now
# just add new fields to this class and it will be fine
class CommonUser(BaseModel):
    tg_chat_id: str | None = None
    custom_pl_name_pattern: str | None = None
    custom_pl_description_pattern: str | None = None
    # NOTE:  this field is required for auth
    refresh_token_hash: str | None = None


class BaseUser(BaseModel):
    dw_playlist_id: str | None = None
    save_full_playlist: bool = False
    filter_dislikes: bool = True


class User(BaseUser, CommonUser):
    user_id: str
    created_at: str
    send_mail: bool = False
    email: Optional[EmailStr | Literal[""]] = None
    send_time: Optional[str] = None
    is_premium: bool
    refresh_token: str | None = None

    @field_validator("send_time", "created_at", mode="before")
    def parse_birthdate(cls, value):
        if value:
            if isinstance(value, str):
                return value
            assert isinstance(value, datetime)
            return str(value)


class PublicUser(BaseUser):
    user_id: str
    created_at: str
    send_mail: bool = False
    email: Optional[EmailStr | Literal[""]] = None
    send_time: Optional[str] = None
    is_premium: bool
    tg_chat_id: str | None = None
    custom_pl_name_pattern: str | None = None
    custom_pl_description_pattern: str | None = None

    @field_validator("send_time", "created_at", mode="before")
    def parse_dates(cls, value):
        if value is None or isinstance(value, str):
            return value
        assert isinstance(value, datetime)
        return str(value)


class CreateUser(BaseUser, CommonUser):
    user_id: str
    send_mail: bool = False
    email: EmailStr | None = None
    send_time: datetime | None = None
    is_premium: bool
    refresh_token: str | None = None


class UpdateUser(CommonUser, BaseModel):
    send_mail: bool | None = None
    email: EmailStr | Literal[""] | None = None
    send_time: datetime | Literal[""] | None = None
    is_premium: bool | None = None
    refresh_token: str | None = None
    dw_playlist_id: str | None = None
    save_full_playlist: bool | None = None
    filter_dislikes: bool | None = None

    @field_validator("send_time", mode="after")
    def parse_date(cls, value):
        if value:
            return str(value)
        return ""


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
    send_mail: bool
    dw_playlist_id: str
    refresh_token: str | None = None
    filter_dislikes: bool
    save_full_playlist: bool
