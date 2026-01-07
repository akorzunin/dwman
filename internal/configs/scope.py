"""permissions for soptify token"""

scope_dict = {
    "user-read-playback-position": False,
    "user-read-private": True,
    "user-read-email": False,
    "playlist-read-private": False,
    "user-library-read": False,
    "user-library-modify": False,
    "user-top-read": False,
    "playlist-read-collaborative": False,
    "playlist-modify-public": True,
    "playlist-modify-private": True,
    "playlist-read-public": False,
    "ugc-image-upload": False,
    "user-follow-read": False,
    "user-follow-modify": False,
    "user-read-playback-state": True,
    "user-modify-playback-state": True,
    "user-read-currently-playing": True,
    "user-read-recently-played": True,
}
scope_str = " ".join([k for k, v in scope_dict.items() if v])
