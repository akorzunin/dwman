import { FC } from 'react';
import { cn } from '../lib/utils';

interface IPlaylistTitle {
  title: string;
  isDW: boolean;
  className?: string;
}

const PlaylistTitle: FC<IPlaylistTitle> = ({ title, isDW, className }) => {
  return (
    <div
      className={cn(
        `rounded-md border border-transparent px-4 py-2 font-medium text-primary`,
        isDW ? 'bg-secondary' : 'bg-third',
        className
      )}
    >
      {title}
    </div>
  );
};

export default PlaylistTitle;
