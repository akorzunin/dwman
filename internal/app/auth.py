import secrets

from fastapi import HTTPException, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from internal.settings import API_LOGIN, API_PASSWORD

security = HTTPBasic()


def check_credentials(credentials: HTTPBasicCredentials) -> bool:
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
