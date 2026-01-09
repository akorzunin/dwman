import { readCookies, setCookies } from './cookieHandle';
import { emptySong, Song } from '../interfaces/Song';

import { SpotifyApi } from '../api/SpotifyApi';
import { Playback } from '../interfaces/Playback';
import { getSpotifyUrl } from './utils';
import { getAccessToken } from './auth';
import { OpenAPI } from '../api/client';
import { getTimeData, TimeData } from './timeMangment';
import dayjs from 'dayjs';

const checkStatusCode = (res: Response) => {
  const logErr = (res: Response) => {
    res.json().then((err) => {
      console.table(err.error);
    });
  };
  if (res.status > 399) {
    if (res.status === 401) {
      console.error('Token is invalid trying to refresh');
      logErr(res);
      refreshToken();
      return false;
    }
    if (res.status === 403) {
      console.error('Need paid user for that');
      logErr(res);
      return false;
    }
    if (res.status === 503) {
      // somtimes happening for no reason
      // probably cause of packet loss or sth like that
      console.warn('Connection error');
      return false;
    }
  }

  return true;
};

export const refreshToken = () => {
  const refreshToken = readCookies()[0].refresh_token;
  if (refreshToken === 'undefined' || typeof refreshToken === 'undefined') {
    throw new Error('Cant refresh token because no cookies available');
  }
  fetch(`${OpenAPI.BASE}/api/refresh_token`, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then((res) => res.json())
    .then((data) => {
      // save data to browser cookies
      setCookies(data);
      localStorage.setItem('refresh_token', data.refresh_token);
    })
    .catch((err) => {
      console.error(err);
    });
};
export interface SpotifyUserData {
  name: string;
  img: string;
  followers: number;
  id: string;
  isPremium: boolean;
}
export const getUserData = async (): Promise<SpotifyUserData> => {
  const token = await getAccessToken();
  const res = await fetch(getSpotifyUrl('/v1/me/', false), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = (await res.json()) as SpotifyApi.CurrentUsersProfileResponse;
  let isPremium = false;
  if (data.product === 'premium') {
    isPremium = true;
  }
  let userImage: string;
  if (!data.images) {
    userImage = '';
  } else {
    userImage = data.images[0].url;
  }
  return {
    name: data.display_name || 'No User',
    img: userImage,
    followers: data?.followers?.total || 0,
    id: data.id,
    isPremium: isPremium,
  };
};

export const getUserPlayback = async () => {
  const token = await getAccessToken();
  const res = await fetch(getSpotifyUrl('/v1/me/player', false), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 204) {
    console.info('No content');
    return false;
  }
  if (checkStatusCode(res)) {
    const data = (await res.json()) as SpotifyApi.CurrentlyPlayingObject;
    return data;
  }
  return false;
};

const isPlaybackPlaylist = (
  data: SpotifyApi.CurrentlyPlayingObject
): string | boolean => {
  if (!data.context) {
    console.warn('No context');
    return false;
  }
  try {
    if (data.context.type === 'playlist') {
      return data.context.uri;
    } else if (data.context.type === 'album') {
      console.warn('No playlist found, album is playing');
      return false;
    } else {
      throw new Error('No playlist found');
    }
  } catch (err) {
    if (err instanceof TypeError) {
      if (data.item?.type === 'track') {
        console.warn('No playlist found');
        return false;
      }
      throw new Error('No playlist in a playback');
    } else {
      throw err; // re-throw the error unchanged
    }
  }
};

const badPlaylistIds: string[] = [];

const getPlaylistSongs = async (
  playlistUri: string,
  currentSong: Song
): Promise<Playback> => {
  const playlistId = playlistUri.split(':').pop() as string;
  if (badPlaylistIds.includes(playlistId)) {
    return [[], false, currentSong];
  }
  const token = await getAccessToken();
  const res = await fetch(getSpotifyUrl(`/v1/playlists/${playlistId}`, false), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    // seems like u cant get special playlists like "Discover Weekly" or Daily mixes
    if (res.status === 404) {
      badPlaylistIds.push(playlistId);
    }
    return [[], false, currentSong];
  }
  const data = (await res.json()) as SpotifyApi.PlaylistObjectFull;
  const songs: Song[] = [];
  data.tracks.items.forEach((song) => {
    songs.push({
      name: song?.track?.name || '',
      artists: song?.track?.artists.map((i) => i.name) || [],
      uri: song?.track?.uri,
      imgUrl: song?.track?.album.images[2].url || '',
    });
  });
  return [songs, data, currentSong];
};
export const getPlayBackSongs = async (
  prevData: Playback
): Promise<Playback> => {
  const data = await getUserPlayback();
  if (!data || !data?.item) {
    console.warn('No user playback');
    const noPlInfo = false;
    const emptySongs = [emptySong];
    return [emptySongs, noPlInfo, emptySong];
  }
  if (data.item?.type !== 'track') {
    throw new Error('Cant handle this type of song');
  }
  const currentSong: Song = {
    name: data.item.name,
    imgUrl: data.item.album.images[2].url,
    artists: data.item.artists.map((artist) => artist.name),
    id: data.item.uri,
  };
  let playlistUri: string | boolean = false;
  try {
    playlistUri = isPlaybackPlaylist(data);
  } catch (err) {
    console.warn(err);
  }
  if (data.currently_playing_type === 'track' && playlistUri === false) {
    console.warn('Currently playing track');
    return [[], false, currentSong];
  }

  let songs: Song[] = [];
  const prevPlaylistUri = prevData[1] && prevData[1].uri;
  if (playlistUri && playlistUri !== prevPlaylistUri) {
    // fetch all songs from new playlist
    return await getPlaylistSongs(playlistUri.toString(), currentSong);
  }
  if (playlistUri) {
    // only update current song if same playlist is playing
    return [prevData[0], prevData[1], currentSong];
  }
  songs = [
    {
      name: data.item.name,
      artists: data.item.artists.map((artist) => artist.name),
      uri: data.item.uri,
      imgUrl: data.item.album.images[2].url,
    },
  ];
  return [songs, false, currentSong];
};

interface IrenderTemplate {
  template: string;
  songs: Song[];
  kaomoji?: string;
}

const renderTemplate = ({ template, songs, kaomoji }: IrenderTemplate) => {
  return template.replace(/{([^{}]+)}/g, (_, key) => {
    const d = dayjs();
    switch (key) {
      case 'year':
        return String(getTimeData().fullYear);
      case 'month':
        return String(d.month() + 1);
      case 'day':
        return String(d.date());
      case 'week':
        return String(getTimeData().weekNumber);
      case 'created':
        return String(d.format('YYYY-MM-DD HH:mm:ss'));
      case '<3':
        return '❤️';
      case 'kaomoji':
        return kaomoji || '';
      case 'songs_num':
        return String(songs?.length);
      case 'repo_url':
        return 'https://github.com/akorzunin/dwman';
      default:
        return '';
    }
  });
};

export interface IgeneratePlData {
  name?: string;
  description?: string;
  date?: TimeData;
  songs?: Song[];
  kaomoji?: string;
}
export interface IplData {
  name: string;
  description: string;
}
export const generatePlData = async ({
  name = '',
  description = '',
  date = getTimeData(),
  songs = [],
  kaomoji,
}: IgeneratePlData): Promise<IplData> => {
  const plData: IplData = {
    name,
    description,
  };
  if (!name) {
    plData.name = `${date.fullYear}_${date.weekNumber}`;
  } else {
    plData.name = renderTemplate({ template: name, songs, kaomoji });
  }
  if (!description) {
    // replace regular space w/ U+205F cause of bug
    plData.description =
      `Created at: ${date.currentTime}. This playlist was created by dwman (https://github.com/akorzunin/dwman)`
        .split(' ')
        .join(' ');
  } else {
    plData.description = renderTemplate({
      template: description,
      songs,
      kaomoji,
    })
      .split(' ')
      .join(' ');
  }
  return plData;
};

export interface IsaveUserPl {
  songs: Song[];
  playlistName?: string;
  playlistDescription?: string;
  kaomoji?: string;
}

export const saveUserPl = async ({
  songs,
  playlistName,
  playlistDescription,
  kaomoji,
}: IsaveUserPl): Promise<
  [SpotifyApi.AddTracksToPlaylistResponse | null, Error | null]
> => {
  // Create new playlist
  const userData = await getUserData();
  const PlData = await generatePlData(
    playlistName,
    playlistDescription,
    getTimeData(),
    { songs: songs, kaomoji: kaomoji }
  );
  if (!userData.id) {
    return [null, Error('No user id')];
  }
  const token = await getAccessToken();
  const res = await fetch(
    getSpotifyUrl(`/v1/users/${userData.id}/playlists`, false),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: PlData.name,
        description: PlData.description,
        public: true,
      }),
    }
  );
  if (!checkStatusCode(res)) {
    return [null, Error(`Cant create playlist, status: ${res.status}`)];
  }
  const resData = (await res.json()) as SpotifyApi.CreatePlaylistResponse;
  if (songs.length === 0) {
    return [resData, null];
  }
  // wait some time before spotify create playlist
  await new Promise((resolve) => setTimeout(resolve, 500));
  // add songs to playlist
  const plRes = await fetch(
    getSpotifyUrl(`/v1/playlists/${resData.id}/tracks`, false),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        uris: songs.map((x) => {
          if (x.id) {
            return x.id;
          } else {
            return x.uri;
          }
        }),
      }),
    }
  );
  if (!checkStatusCode(plRes)) {
    return [null, Error(`Cant add songs to playlist, status: ${plRes.status}`)];
  }
  const data = (await plRes.json()) as SpotifyApi.AddTracksToPlaylistResponse;
  console.info('Created', data);
  return [data, null];
};
