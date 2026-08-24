import { useAtom } from 'jotai';
import { Ear, EarOff, Plus } from 'lucide-react';
import { FC } from 'react';
import { Song } from '../../interfaces/Song';
import { cn } from '../../lib/utils';
import { Button } from '../../shadcn/ui/button';
import { listenPlaybackAtom, SongSetAtom } from '../../store/store';
import SongView from './../songs/SongView';

interface ISongCard {
  song: Song;
  isDeletable?: boolean;
  isHidden?: boolean;
  isAddable?: boolean;
  className?: string;
}

const SongCard: FC<ISongCard> = ({ song, isHidden, isAddable, className }) => {
  const [, addSong] = useAtom(SongSetAtom);
  const [listenPlayback, setListenPlayback] = useAtom(listenPlaybackAtom);

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border-2 border-solid px-4 py-2 text-primary-foreground laptop:w-[380px]',
        isHidden && 'hidden',
        className
      )}
    >
      <div className="flex w-[85%] flex-shrink items-center gap-x-3">
        <SongView song={song} />
      </div>
      <div className="flex">
        <Button
          variant="secondary"
          className="rounded-none rounded-l-md px-2"
          onClick={() => isAddable && addSong(song)}
        >
          <Plus />
        </Button>
        <Button
          variant="secondary"
          className="rounded-none rounded-r-md border-l-2 px-2 transition-none"
          onClick={() => setListenPlayback(!listenPlayback)}
        >
          {listenPlayback ? (
            <EarOff className="h-4 w-4" />
          ) : (
            <Ear className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default SongCard;
