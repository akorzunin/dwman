import { useQuery } from '@tanstack/react-query';
import { useAtom, useAtomValue } from 'jotai';
import { FC, useState } from 'react';
import { SpotifyApi } from '../../api/SpotifyApi';
import Playlist from '../../components/Playlist';
import SavePlaylist from '../../components/SavePlaylist';
import { SettingsPanelV2 } from '../../components/settings/SettingsPanelV2';
import { emptySong } from '../../interfaces/Song';
import { cn } from '../../lib/utils';
import {
  CurrentSongAtom,
  listenPlaybackAtom,
  PlaylistSongsAtom,
  SongSetAtom,
} from '../../store/store';
import * as apiManager from '../../utils/apiManager';

export const UserPage: FC = () => {
  const [PlSongs, setPlSongs] = useAtom(PlaylistSongsAtom);
  const [isDW, setIsDW] = useState(false);
  const [PlaylistName, setPlaylistName] = useState('No playlist name');
  const [, setCurrentSong] = useAtom(CurrentSongAtom);
  const listenPlayback = useAtomValue(listenPlaybackAtom);
  const [, addToSaveSongSet] = useAtom(SongSetAtom);

  const isDiscoverWeekly = (data: SpotifyApi.PlaylistObjectFull): boolean => {
    return data.images[0].url.search('discover') > 0;
  };

  const { data: playback } = useQuery({
    queryKey: ['player'],
    queryFn: async () => {
      const newPlayback = await apiManager.getPlayBackSongs(playback.data);
      const [songs, playlistData, currentSong] = newPlayback;
      if (playlistData) {
        setPlaylistName(playlistData.name);
        const isDiscoverWeeklyPl = isDiscoverWeekly(playlistData);
        setIsDW(isDiscoverWeeklyPl);
      }
      setCurrentSong(currentSong);
      setPlSongs(songs);
      if (listenPlayback) {
        addToSaveSongSet(currentSong);
      }
      return { data: newPlayback };
    },
    refetchInterval: 3000,
    initialData: { data: [[emptySong], false, emptySong] },
    enabled: listenPlayback,
  });

  return (
    <div className="mx-auto flex h-[70vh] flex-col gap-y-3 laptop:w-full laptop:flex-row laptop:justify-center laptop:gap-x-3">
      <Playlist
        title={PlaylistName}
        songs={PlSongs}
        isDW={isDW}
        className={cn('', PlSongs.length === 0 && 'hidden')}
      />
      <SavePlaylist className="" />
      <SettingsPanelV2 className="" />
    </div>
  );
};

export default UserPage;
