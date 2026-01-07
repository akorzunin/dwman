import asyncio
from datetime import date, datetime, timezone
from typing import Optional

from backend.app.shemas import SavePlUser
from backend.app.types import DeviceId, Song


def all_dw_songs(
    sp,
    dw_id: str,
) -> list[Song]:
    dw_items = sp.playlist_items(dw_id)
    return [
        Song(
            name=i["track"]["name"],
            uri=i["track"]["uri"],
            id=i["track"]["id"],
        )
        for i in dw_items["items"]
    ]


async def filter_dw_songs(
    sp,
    device: DeviceId,
    dw_id: str,
) -> list[Song]:
    # play dw playlist
    sp.start_playback(device, context_uri=dw_id)
    # skip 30 songs
    songs = []
    for i in range(30):
        sp.start_playback(device, context_uri=dw_id, offset={"position": i})
        await asyncio.sleep(1)
        song = sp.current_playback()
        # print(song)song
        if song["is_playing"]:
            songs.append(
                Song(
                    id=song["item"]["id"],
                    uri=song["item"]["uri"],
                    name=song["item"]["name"],
                )
            )
    sp.pause_playback(device)
    return songs


async def save_playlist_to_user(
    sp,
    songs: list[Song],
    user_id: str,
) -> None:
    # save new playlist
    name = get_pl_name(user_id)
    description = get_pl_description(user_id)
    new_pl = sp.user_playlist_create(
        user=user_id,
        name=name,
        public=True,
        description=description,
    )
    await asyncio.sleep(0.5)
    # add songs from data to it
    sp.user_playlist_add_tracks(
        user=user_id,
        playlist_id=new_pl["id"],
        tracks=[i.id for i in songs],
        position=None,
    )


def get_pl_name(user_id) -> str:
    """Generate user defined playlist name or default"""
    # TODO implement custom user pl name
    d = datetime.now(timezone.utc)
    week = date(d.year, d.month, d.day).strftime("%V")
    return f"{d.year}_{week}"


def get_pl_description(user_id):
    """Generate user defined description or default"""
    d = datetime.now(timezone.utc)
    #  got a strange bug where any description w/ spaces of any kind is not saved
    return str(
        f"""Creation date: {d.strftime("%Y-%m-%d %H:%M:%S %Z")}. This playlist was created by spotifysavedw web service. Link to github repo /akorzunin/Spotify_save_DW""".replace(
            " ", " "
        )
    )  # replace regular space w/ U+205F cause of this bug


async def get_dw_songs(
    sp,
    user: SavePlUser,
) -> Optional[list[Song]]:
    if user.filter_dislikes:
        # get devices
        devices = sp.devices()["devices"]
        device = get_device_id(
            # TODO use user.preferred_device to pick one
            devices,
        )
        if not device:
            raise TypeError("No device found")
        # use playback alg
        songs = await filter_dw_songs(sp, device, user.dw_playlist_id)
        if len(songs) <= 30:
            if user.save_full_playlist:
                # save songs anyway
                return songs
            # don save songs, send mail probably
            return None
        # save songs
        return songs
    if user.save_full_playlist:
        # dot use playback alg
        songs = all_dw_songs(sp, user.dw_playlist_id)
        return songs
    return None


async def save_playlist_algorithm(
    sp,
    user: SavePlUser,
):
    songs = await get_dw_songs(sp, user)
    if not songs:
        raise ValueError("No songs in playlist")
    await save_playlist_to_user(sp, songs, user.user_id)
    # TODO move mailing logic here


def get_device_id(
    devices: list[dict],
    preferred: DeviceId | None = None,
) -> Optional[DeviceId]:
    """Return preferred device if it exists else first existing device or None"""
    if not preferred and devices:
        return DeviceId(devices[0]["id"])
    if preferred in [i["id"] for i in devices]:
        return preferred
    return None
