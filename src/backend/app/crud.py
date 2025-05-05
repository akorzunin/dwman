from datetime import datetime, timezone

from tinydb import TinyDB, where

from backend.app import shemas


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


def create_user(db, user: shemas.CreateUser) -> shemas.User:
    if not db.get(where("user_id") == user.user_id):
        new_user = user.model_dump() | {
            "created_at": datetime.now(timezone.utc)
        }
        parced_user = shemas.User(**new_user)
        db.insert(parced_user.model_dump())
        return parced_user
    raise ValueError("Could not create new user")


def update_user(
    db: TinyDB,
    user: shemas.UpdateUser,
    user_id: str,
) -> shemas.User:
    if user_upd := {
        k: v for k, v in user.model_dump().items() if v is not None
    }:
        db.update(user_upd, where("user_id") == user_id)
        user_doc = db.get(where("user_id") == user_id)
        return shemas.User(**user_doc)
    raise ValueError("Could not update user")


def delete_user(db, user_id: str):
    if db.get(where("user_id") == user_id):
        return db.remove(where("user_id") == user_id)
