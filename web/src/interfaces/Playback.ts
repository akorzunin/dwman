import { SpotifyApi } from '../api/SpotifyApi';
import { Song } from './Song';

// [all playlist songs, playlist id or false, current song]
export type Playback = [Song[], SpotifyApi.PlaylistObjectFull | false, Song];
