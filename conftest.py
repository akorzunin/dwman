import pytest
from fastapi.testclient import TestClient
from tinydb import TinyDB
from tinydb.storages import MemoryStorage

from src.backend.app.db_connector import get_users_table
from src.main import app


@pytest.fixture(scope="function")
def client():
    """FastAPI TestClient with a clean table."""
    users_table = TinyDB(storage=MemoryStorage).table("users")
    app.dependency_overrides[get_users_table] = lambda: users_table
    with TestClient(app) as c:
        yield c
