import { useState } from 'react';
import { saveUserPl } from '../utils/apiManager';
import SaveSongPlaylist from './SaveSongPlaylist';
import PlaylistTitle from './PlaylistTitle';
import { Button } from '../shadcn/ui/button';
import { useAtom, useAtomValue } from 'jotai';
import {
  clrearSongSetAtom,
  listenPlaybackAtom,
  PlaylistSongsAtom,
} from '../store/store';
import { fullYear, weekNumber } from '../utils/timeMangment';
import { cn } from '../lib/utils';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@radix-ui/react-dropdown-menu';

const dotClassName =
  'absolute right-[-6px] top-[-6px] inline-flex h-3 w-3 bg-purple-700';

const SavePlaylist = ({ className }: { className?: string }) => {
  const [IsSpinning, setIsSpinning] = useState(false);
  const [savePlState, setSavePlState] = useState('Save');
  const [listenPlayback, setListenPlayback] = useAtom(listenPlaybackAtom);
  const [PingState, setPingState] = useState<'' | 'hidden'>('hidden');

  const [, clrearSongSet] = useAtom(clrearSongSetAtom);
  const PlaylistSongs = useAtomValue(PlaylistSongsAtom);

  const onClear = () => {
    setPingState('hidden');
    setSavePlState('Save');
    clrearSongSet();
  };

  const saveUserPlaylist = async (opts?: {
    full?: boolean;
    empty?: boolean;
  }) => {
    setSavePlState('Saving...');
    let ok = false;
    if (opts?.full) {
      ok = await saveUserPl(PlaylistSongs);
    } else if (opts?.empty) {
      ok = await saveUserPl([]);
    }
    if (ok) {
      setPingState('hidden');
      setSavePlState('Saved');
    } else {
      setSavePlState('Error');
    }
    setTimeout(() => {
      setSavePlState('Save');
    }, 5000);
  };

  return (
    <div className={cn('flex w-full flex-col gap-y-3', className)}>
      <div className={IsSpinning ? 'animate-spin' : ''}>
        <PlaylistTitle
          title={`Saved playlist: ${fullYear}_${weekNumber}`}
          isDW={true}
        />
        <div className="flex justify-between gap-3 p-3">
          <div className="relative inline-flex">
            <Button
              variant="secondary"
              className=" rounded-none rounded-l-md"
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
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={5}
                className="z-100 flex w-52 flex-col gap-2 rounded-md bg-secondary p-2 text-primary"
              >
                <DropdownMenuItem>
                  <Button
                    onClick={() => saveUserPlaylist({ empty: true })}
                    variant="ghost"
                    className="w-full"
                  >
                    Save empty playlist
                  </Button>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Button
                    onClick={() => saveUserPlaylist({ full: true })}
                    variant="ghost"
                    className="w-full"
                  >
                    Save full playlist
                  </Button>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button variant="third" onClick={onClear}>
            Clear
          </Button>
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
        </div>
        <SaveSongPlaylist />
      </div>
    </div>
  );
};

export default SavePlaylist;
