from datetime import datetime, timezone

import bcrypt
from tinydb import TinyDB, where
from tinydb.table import Table

from internal.app import shemas


def get_all_users(
    db,
) -> list[dict]:
    return db.search(where("user_id").exists())


def get_user(db, user_id: str):
    user = db.get(where("user_id") == user_id)
    if user is None:
        return
    return shemas.User(**user)


def get_user_by_email(db, email: str):
    return shemas.User(**db.get(where("email") == email))


def get_user_by_tg_chat_id(db, tg_chat_id: str):
    return shemas.User(**db.get(where("tg_chat_id") == tg_chat_id))


def hash_refresh_token(refresh_token: str) -> str:
    # bcrypt accepts at most 72 bytes; auth applies the same limit.
    return bcrypt.hashpw(
        refresh_token.encode("utf-8")[:72], bcrypt.gensalt()
    ).decode("utf-8")


def create_user(db, user: shemas.CreateUser) -> shemas.User:
    if db.get(where("user_id") == user.user_id):
        raise ValueError("User already exists")
    if not user.refresh_token_hash:
        raise ValueError("Refresh token hash field is required")
    user.refresh_token_hash = hash_refresh_token(user.refresh_token_hash)
    new_user = user.model_dump() | {"created_at": datetime.now(timezone.utc)}
    parced_user = shemas.User(**new_user)
    db.insert(parced_user.model_dump())
    return parced_user


def get_user_by_refresh_token(db, refresh_token: str):
    """Find a user by token, including legacy records without plaintext tokens."""
    user = db.get(where("refresh_token") == refresh_token)
    if user is not None:
        return shemas.User(**user)

    for user in db.all():
        token_hash = user.get("refresh_token_hash")
        if not token_hash:
            continue
        try:
            matches = bcrypt.checkpw(
                refresh_token.encode("utf-8")[:72], token_hash.encode("utf-8")
            )
        except (TypeError, ValueError):
            matches = False
        if matches:
            return shemas.User(**user)
    return None


def update_refresh_token(
    db: TinyDB | Table,
    user_id: str,
    refresh_token: str,
) -> shemas.User:
    """Atomically replace a user's token and its authentication hash."""
    if not db.get(where("user_id") == user_id):
        raise ValueError("User not found")
    updated = db.update(
        {
            "refresh_token": refresh_token,
            "refresh_token_hash": hash_refresh_token(refresh_token),
        },
        where("user_id") == user_id,
    )
    if not updated:
        raise ValueError("User not found")
    user_doc = db.get(where("user_id") == user_id)
    return shemas.User(**user_doc)  # type: ignore


def update_user(
    db: TinyDB | Table,
    user: shemas.UpdateUser,
    user_id: str,
) -> shemas.User:
    if not db.get(where("user_id") == user_id):
        raise ValueError("User not found")
    if user.refresh_token_hash is not None and user.refresh_token is None:
        raise ValueError("refresh_token is required when updating its hash")

    if user_upd := {
        k: v for k, v in user.model_dump().items() if v is not None
    }:
        if user.refresh_token is not None:
            user_upd["refresh_token_hash"] = hash_refresh_token(
                user.refresh_token
            )
        db.update(user_upd, where("user_id") == user_id)
        user_doc = db.get(where("user_id") == user_id)
        return shemas.User(**user_doc)  # type: ignore
    raise ValueError("Could not update user")


def delete_user(db, user_id: str):
    if db.get(where("user_id") == user_id):
        return db.remove(where("user_id") == user_id)
