import { useState } from 'react';
import { saveUserPl } from '../utils/apiManager';
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
import { fullYear, weekNumber } from '../utils/timeMangment';
import { cn } from '../lib/utils';
import { ChevronDown, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';
import { Song } from '../interfaces/Song';

const dotClassName =
  'absolute right-[-6px] top-[-6px] inline-flex h-3 w-3 bg-purple-700';

const SavePlaylist = ({ className }: { className?: string }) => {
  const [IsSpinning, setIsSpinning] = useState(false);
  const [savePlState, setSavePlState] = useState('Save');
  const [listenPlayback, setListenPlayback] = useAtom(listenPlaybackAtom);
  const [PingState, setPingState] = useState<'' | 'hidden'>('hidden');

  const [, clrearSongSet] = useAtom(clrearSongSetAtom);
  const PlaylistSongs = useAtomValue(PlaylistSongsAtom);
  const currentSongs = useAtomValue(SongSetAtom);

  const playlistName = useAtomValue(PlaylistNameTemplateAtom);
  const playlistDescription = useAtomValue(PlaylistDescriptionTemplateAtom);
  const easterEggKaomoji = useAtomValue(easterEggKaomojiAtom);

  const onClear = () => {
    setPingState('hidden');
    setSavePlState('Save');
    clrearSongSet();
  };
  type Opts = { full?: boolean; empty?: boolean };
  const saveUserPlaylist = async (opts?: Opts) => {
    setSavePlState('Saving...');
    setTimeout(() => {
      setSavePlState('Save');
    }, 5000);
    const PlData = {
      playlistName,
      playlistDescription,
      kaomoji: easterEggKaomoji,
    };
    function getSongs(
      opts: Opts | undefined,
      pls: Song[],
      current: Song[]
    ): Song[] {
      if (opts?.full) {
        return pls;
      }
      if (opts?.empty) {
        return current;
      }
      return current;
    }
    const songs = getSongs(opts, PlaylistSongs, currentSongs.items);
    const [data, err] = await saveUserPl(songs, PlData);
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
        <PlaylistTitle
          title={`Saved playlist: ${fullYear}_${weekNumber}`}
          isDW={true}
        />
        <div className="flex justify-between gap-3 overflow-x-hidden py-2">
          <div className="relative inline-flex">
            <Button
              variant="secondary"
              className="rounded-none rounded-l-md"
              onClick={async () => saveUserPlaylist()}
            >
              {savePlState}
            </Button>
            <span className={cn('flex rounded-full', PingState)}>
              <span
                className={cn(
                  dotClassName,
                  'animate-ping rounded-full opacity-75'
                )}
              ></span>
              <span className={cn(dotClassName, 'rounded-full')}></span>
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="rounded-none rounded-r-md border-l-2"
                >
                  <ChevronDown className="absolute h-[1.2rem] w-[1.2rem]" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={5}
                className="z-1000 flex w-52 flex-col gap-2 rounded-md bg-secondary bg-opacity-100 p-2 text-primary opacity-100"
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
