import { useAtom } from 'jotai';
import { Plus, X } from 'lucide-react';
import { FC } from 'react';
import { Song } from '../../interfaces/Song';
import { cn } from '../../lib/utils';
import { deleteSongSetAtom, SongSetAtom } from '../../store/store';
import SongView from './../songs/SongView';

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
        <SongView song={song} />
      </div>
      <div className="flex gap-x-3">
        <button
          type="button"
          className={cn(
            'hover:pointer cursor-pointer rounded-md border-2 border-solid p-1 transition hover:border-transparent hover:bg-destructive',
            !isDeletable && 'hidden'
          )}
          onClick={() => isDeletable && deleteSong(song)}
        >
          <X />
        </button>
        <button
          type="button"
          className={cn(
            'hover:pointer cursor-pointer rounded-md border-2 border-solid p-1 transition hover:border-transparent hover:bg-third',
            !isAddable && 'hidden'
          )}
          onClick={() => isAddable && addSong(song)}
        >
          <Plus />
        </button>
      </div>
    </div>
  );
};

export default SongCard;
