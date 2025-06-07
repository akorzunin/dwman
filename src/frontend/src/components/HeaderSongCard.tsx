import { FC } from 'react';
import { Song } from '../interfaces/Song';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../shadcn/ui/avatar';
import { useAtom } from 'jotai';
import { listenPlaybackAtom, SongSetAtom } from '../store/store';
import { Ear, EarOff, Plus } from 'lucide-react';
import { Button } from '../shadcn/ui/button';

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
        'items-center justify-between rounded-md border-2 border-solid px-4 py-2 text-primary-foreground tablet:flex tablet:w-[320px] desktop:w-[380px]',
        isHidden && 'hidden',
        className
      )}
    >
      <div className="flex w-[85%] flex-shrink items-center gap-x-3">
        <Avatar className="-z-10 h-[64px] w-[64px] rounded-none">
          <AvatarImage src={song.imgUrl} className="h-full" alt="song cover" />
          <AvatarFallback className="rounded-none">NA</AvatarFallback>
        </Avatar>
        <div className="">
          <p className="line-clamp-1">{song.name.slice(0, 30)}</p>
          <p className="line-clamp-1 opacity-80">
            {song.artists.map((artist) => artist).join(', ')}
          </p>
        </div>
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
          className={cn(
            'rounded-none rounded-r-md border-l-2 px-2 transition-none',
            !listenPlayback && 'bg-secondary/60'
          )}
          onClick={() => setListenPlayback(!listenPlayback)}
        >
          {listenPlayback ? (
            <Ear className="h-4 w-4" />
          ) : (
            <EarOff className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

export default SongCard;
