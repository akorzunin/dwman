import { FC, useState } from 'react';
import { generatePlData, saveUserPl } from '../utils/apiManager';
import SaveSongPlaylist from './SaveSongPlaylist';
import PlaylistTitle from './PlaylistTitle';
import { Button } from '../shadcn/ui/button';
import { useAtom, useAtomValue } from 'jotai';
import {
  clrearSongSetAtom,
  easterEggKaomojiAtom,
  listenPlaybackAtom,
  PlaylistDescriptionTemplateAtom,
  PlaylistNameTemplateAtom,
  PlaylistSongsAtom,
  SongSetAtom,
} from '../store/store';
import { cn } from '../lib/utils';
import { ChevronDown, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
} from '@radix-ui/react-dropdown-menu';
import { useQuery } from '@tanstack/react-query';

const dotClassName =
  'absolute right-[-6px] top-[-6px] inline-flex h-3 w-3 bg-purple-700';

const SavePlaylist: FC<{ className?: string }> = ({ className }) => {
  const [IsSpinning, setIsSpinning] = useState(false);
  const [savePlState, setSavePlState] = useState('Save');
  const [listenPlayback, setListenPlayback] = useAtom(listenPlaybackAtom);
  const [PingState, setPingState] = useState<'' | 'hidden'>('hidden');

  const [, clrearSongSet] = useAtom(clrearSongSetAtom);
  const PlaylistSongs = useAtomValue(PlaylistSongsAtom);
  const currentSongs = useAtomValue(SongSetAtom);

  const [playlistName] = useAtom(PlaylistNameTemplateAtom);
  const playlistDescription = useAtomValue(PlaylistDescriptionTemplateAtom);
  const easterEggKaomoji = useAtomValue(easterEggKaomojiAtom);

  // const { userId } = useParams();
  // const plDescriptionQuery = useQuery({
  //   queryKey: ['customPlName', userId],
  //   queryFn: async () => {
  //     if (!userId) return null;
  //     const res = await ApiService.getUserApiUserGet(userId);
  //     if (!res.ok) return null;
  //     const d: User = await res.json();
  //     if (!d.custom_description_pattern) {
  //       return null;
  //     }
  //     setPlaylistName(d.custom_description_pattern);
  //   },
  // });

  const currentPlNameQuery = useQuery({
    queryKey: ['currentPlName'],
    queryFn: async () => {
      const pl = await generatePlData({
        name: playlistName,
        description: playlistDescription,
      });
      return pl.name;
    },
  });

  const onClear = () => {
    setPingState('hidden');
    setSavePlState('Save');
    clrearSongSet();
  };
  type Opts = { full?: boolean; empty?: boolean };
  const saveUserPlaylist = async ({ full, empty }: Opts = {}) => {
    setSavePlState('Saving...');
    setTimeout(() => {
      setSavePlState('Save');
    }, 5000);
    let songs = currentSongs.items;
    if (full) {
      songs = PlaylistSongs;
    } else if (empty) {
      songs = [];
    }
    const [data, err] = await saveUserPl({
      songs,
      playlistName,
      playlistDescription,
      kaomoji: easterEggKaomoji,
    });
    if (err || data === null) {
      setSavePlState('Error');
      console.error(err);
      return;
    }
    if (Object.keys(data).length) {
      setPingState('hidden');
      setSavePlState('Saved');
    } else {
      setSavePlState('Error');
      console.error('Cant save playlist');
    }
  };

  return (
    <div className={cn('flex w-full flex-col gap-y-3', className)}>
      <div className={IsSpinning ? 'animate-spin' : ''}>
        <div className="flex justify-between">
          <PlaylistTitle
            title={`Playlist: ${currentPlNameQuery.data || '...'}`}
            isDW={true}
            className="flex-auto rounded-r-none"
          />
          <Separator className="h-auto w-0.5" />
          <Button
            variant={'secondary'}
            className="h-auto flex-none rounded-l-none"
          >
            <Edit className="h-[1.2rem] w-[1.2rem] text-primary" />
          </Button>
        </div>
        <div className="flex justify-between overflow-x-hidden py-2">
          <div className="relative flex">
            <Button
              variant="secondary"
              className="rounded-none rounded-l-md"
              onClick={async () => saveUserPlaylist()}
            >
              {savePlState}
            </Button>
            <Separator className="relative h-auto w-0.5">
              <span className={cn('flex rounded-full', PingState)}>
                <span
                  className={cn(
                    dotClassName,
                    'animate-ping rounded-full opacity-75'
                  )}
                ></span>
                <span className={cn(dotClassName, 'rounded-full')}></span>
              </span>
            </Separator>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="rounded-none rounded-r-md"
                >
                  <ChevronDown className="h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={5}
                className="flex w-52 flex-col gap-2 rounded-md bg-secondary bg-opacity-100 p-2 text-primary opacity-100"
              >
                <DropdownMenuItem>
                  <Button
                    onClick={() => saveUserPlaylist({ empty: true })}
                    className="w-full"
                  >
                    Save empty playlist
                  </Button>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Button
                    onClick={() => saveUserPlaylist({ full: true })}
                    className="w-full"
                  >
                    Save full playlist
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex gap-x-2">
            <Button
              variant="secondary"
              onClick={() => setIsSpinning(!IsSpinning)}
            >
              Spin
            </Button>
            <Button
              variant={listenPlayback ? 'secondary' : 'third'}
              onClick={() => setListenPlayback(!listenPlayback)}
            >
              From playback
            </Button>
            <Button variant="secondary" onClick={onClear}>
              <Trash2 />
            </Button>
          </div>
        </div>
        <SaveSongPlaylist />
      </div>
    </div>
  );
};

export default SavePlaylist;
