import os
from typing import Annotated

from fastapi import Depends
from tinydb import TinyDB
from tinydb.table import Table

if not os.path.exists("./data"):
    os.mkdir("./data")

db = TinyDB("./data/db.json")


def get_users_table():
    return db.table("users")


# TODO: remove later so we can mock only one object
users = db.table("users")


UsersTable = Annotated[Table, Depends(get_users_table)]
