/// <reference types="vite/client" />

import { OpenAPI } from '../api/client';

const text_emojis = [
  '┬─┬ ノ(゜ - ゜ノ)',
  '(╯°□°）╯︵ ┻━┻',
  '☜(ﾟヮﾟ☜)',
  '( ´･･)ﾉ(._.`)',
  '(｡･∀･)ﾉﾞ',
  '(ToT)/~~~',
  '(∪.∪ )...zzz',
  'ヾ(^▽^*)))',
  '(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧',
  '✪ ω ✪',
  '(☞ﾟヮﾟ)☞',
  '☜(⌒▽⌒)☞',
  '༼ つ ◕_◕ ༽つ',
  'ಠ_ಠ',
];

export const get_text_emoji = (): string => {
  return text_emojis[Math.floor(Math.random() * text_emojis.length)];
};

export const getSpotifyUrl = (path: string, isDirect: boolean): string => {
  if (isDirect) {
    return 'https://api.spotify.com' + path;
  }
  return OpenAPI.BASE + '/api/spotify' + path;
};

export const formatFollowerNumber = (followers: number): string => {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(followers);
};
