// playwright unit test
import { expect, test } from 'vitest';
import { SongSet } from '../../../web/src/utils/songSet';
import { Song } from '../../../web/src/interfaces/Song';

const songs: Song[] = [
  {
    name: 'On My Own',
    imgUrl: 'https://i.scdn.co/image/ab67616d00004851d75523282bf3ba41ea85234f',
    artists: ['Darci'],
    id: 'spotify:track:0F4FejjWi3bf5vGOkuQwPS',
  },
  {
    name: 'Педали',
    imgUrl: 'https://i.scdn.co/image/ab67616d000048516fa00f4fda1d025637cd2622',
    artists: ['WASSSUP'],
    id: 'spotify:track:3WFPTrtVjoP2tKpsp8TPtB',
  },
  {
    name: 'APATHY 5 - Slowed & Reverb',
    imgUrl: 'https://i.scdn.co/image/ab67616d00004851273e3d0832d02aca2f85a596',
    artists: ['ROMANTICA', 'shometyle'],
    id: 'spotify:track:4ce6SEbfvVe3FekaCVY6hP',
  },
];

export const songSetTest = test.extend({
  songSet: async ({}, use) => {
    const songSet = new SongSet();
    songSet.add(songs[0]);
    songSet.add(songs[1]);
    use(songSet);
  },
});

songSetTest('SongSet add', async ({ songSet }: { songSet: SongSet }) => {
  songSet.add(songs[0]);
  songSet.add(songs[0]);
  songSet.add(songs[1]);
  songSet.add(songs[1]);
  songSet.add(songs[2]);
  expect(songSet.size).toBe(3);
});

songSetTest('SongSet has', async ({ songSet }: { songSet: SongSet }) => {
  expect(songSet.has(songs[0])).toBe(true);
  expect(songSet.has(songs[1])).toBe(true);
});

songSetTest('SongSet delete', async ({ songSet }: { songSet: SongSet }) => {
  songSet.delete(songs[0]);
  expect(songSet.has(songs[0])).toBe(false);
  expect(songSet.size).toBe(1);
  songSet.delete(songs[1]);
  expect(songSet.has(songs[1])).toBe(false);
  expect(songSet.size).toBe(0);
});

songSetTest('SongSet size', async ({ songSet }: { songSet: SongSet }) => {
  expect(songSet.size).toBe(2);
});

songSetTest('SongSet key', async ({ songSet }: { songSet: SongSet }) => {
  if (songs[0].id === undefined || songs[1].id === undefined) {
    throw new Error('Song id is undefined');
  }
  expect(songSet.key).toBe(songs[0].id + songs[1].id);
});
