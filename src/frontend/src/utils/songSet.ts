import { emptySong, Song } from '../interfaces/Song';

const keys = ['name', 'artists', 'id'] as const;

export class SongSet {
  items: Song[];
  constructor() {
    this.items = [];
  }

  add(item: Song) {
    if (!this.has(item) && item.name !== emptySong.name) {
      this.items.push(item);
    }
  }

  has(item: Song) {
    return this.items.some((existingItem) =>
      this.deepEqual(existingItem, item)
    );
  }

  delete(item: Song) {
    this.items = this.items.filter(
      (existingItem) => !this.deepEqual(existingItem, item)
    );
  }

  get size() {
    return this.items.length;
  }

  deepEqual(obj1: Song, obj2: Song) {
    if (typeof obj1 !== typeof obj2) return false;

    if (Object.keys(obj1).length !== Object.keys(obj2).length) return false;

    for (const key of keys) {
      if (!(obj1[key] === obj2[key])) return false;
    }

    return true;
  }

  get key() {
    return this.items.reduce((acc, item) => acc + item.id, '');
  }

  clone() {
    const newSet = new SongSet();
    newSet.items = this.items;
    return newSet;
  }
}
