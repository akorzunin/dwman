import { FC } from 'react';

import SongCard from './SongCard';
import { emptySong, Song } from '../interfaces/Song';
import PlaylistTitle from './PlaylistTitle';
import { cn } from '../lib/utils';

interface IPlayList {
  title: string;
  songs: Song[];
  isDW: boolean;
  className?: string;
}

const Playlist: FC<IPlayList> = ({ title, songs, isDW, className }) => {
  return (
    <div className={cn('flex w-full flex-col gap-y-3', className)}>
      <PlaylistTitle title={'Playlist: ' + title} isDW={isDW} />
      <div className="hidden laptop:block laptop:h-9"></div>
      <div className="flex max-h-[70vh] flex-col gap-y-2 overflow-y-scroll">
        {songs.length > 0 ? (
          songs.map((song: Song, index: number) => (
            <SongCard
              key={index.toString()}
              song={song}
              index={index}
              isAddable={true}
            />
          ))
        ) : (
          <div className="opacity-50">
            <SongCard
              song={emptySong}
              index={0}
              isDeletable={false}
              isHidden={undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Playlist;
