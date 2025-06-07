import { FC } from 'react';
import { Song } from '../interfaces/Song';
import { cn } from '../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../shadcn/ui/avatar';
import { useAtom } from 'jotai';
import { deleteSongSetAtom, SongSetAtom } from '../store/store';

interface ISongCard {
  song: Song;
  index: number;
  isDeletable?: boolean;
  isHidden?: boolean;
  isAddable?: boolean;
  className?: string;
}

const SongCard: FC<ISongCard> = ({
  song,
  index,
  isDeletable,
  isHidden,
  isAddable,
  className,
}) => {
  const [, deleteSong] = useAtom(deleteSongSetAtom);
  const [, addSong] = useAtom(SongSetAtom);

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md border-2 border-solid p-2 text-primary-foreground',
        isHidden && 'hidden',
        className
      )}
    >
      <div className="flex w-[85%] flex-shrink items-center gap-x-3">
        <div className="flex">{Number.isNaN(index) ? '' : index}</div>
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
      <div className="flex gap-x-3">
        <button
          className={cn(
            'hover:pointer cursor-pointer rounded-md border-2 border-solid px-4 transition hover:border-transparent hover:bg-destructive',
            !isDeletable && 'hidden'
          )}
          onClick={() => isDeletable && deleteSong(song)}
        >
          X
        </button>
        <button
          className={cn(
            'hover:pointer cursor-pointer rounded-md border-2 border-solid px-4 transition hover:border-transparent hover:bg-third',
            !isAddable && 'hidden'
          )}
          onClick={() => isAddable && addSong(song)}
        >
          {'>'}
        </button>
      </div>
    </div>
  );
};

export default SongCard;
