from dataclasses import dataclass
from typing import NewType

DeviceId = NewType("DeviceId", str)


@dataclass
class Song:
    name: str
    uri: str
    id: str
