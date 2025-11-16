import { FC, useState } from 'react';
import SongCard from './SongCard';
import { emptySong, Song } from '../interfaces/Song';
import { useAtomValue } from 'jotai';
import { SongSetAtom } from '../store/store';
import { Button } from '../shadcn/ui/button';

const SaveSongPlaylist: FC = () => {
  const [, setKey] = useState('');
  const songs = useAtomValue(SongSetAtom);

  const rerender = () => {
    console.log(songs.items);
    setKey(self.crypto.randomUUID());
  };
  return (
    <div className="flex max-h-[70vh] flex-col gap-y-2 overflow-y-scroll">
      {songs.items.length > 0 ? (
        songs.items
          .slice(0)
          .reverse()
          .map((song: Song, index: number) => (
            <SongCard
              key={index}
              song={song}
              index={songs.items.length - index}
              isDeletable={true}
            />
          ))
      ) : (
        <div className="">
          <SongCard song={emptySong} index={0} isDeletable={false} />
        </div>
      )}
      <Button className="hidden" variant="secondary" onClick={() => rerender()}>
        Rerender
      </Button>
    </div>
  );
};

export default SaveSongPlaylist;
