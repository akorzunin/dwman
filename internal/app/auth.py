import secrets
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from internal.app import crud
from internal.app.db_connector import UsersTable
from internal.app.shemas import User
from internal.settings import API_LOGIN, API_PASSWORD

security = HTTPBasic()

Credentials = Annotated[HTTPBasicCredentials, Depends(security)]


def check_credentials(credentials: Credentials) -> bool:
    correct_username = secrets.compare_digest(
        credentials.username,
        API_LOGIN,
    )
    correct_password = secrets.compare_digest(
        credentials.password,
        API_PASSWORD,
    )
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return True


def check_user_credentials(
    credentials: Credentials,
    users_db: UsersTable,
) -> User:
    """Check if user credentials are correct
    use Spotify id as username and refresh token hash as password"""
    u = crud.get_user(users_db, credentials.username)
    if not u or not u.refresh_token_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User or refresh token not found",
        )
    correct_password = bcrypt.checkpw(
        credentials.password.encode("utf-8")[:72],
        u.refresh_token_hash.encode("utf-8"),
    )
    if not correct_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return u
