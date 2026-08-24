import { useAtom } from 'jotai';
import { useState } from 'react';
import { cn } from '../lib/utils';
import { easterEggCountAtom, easterEggKaomojiAtom } from '../store/store';
import { get_text_emoji } from '../utils/utils';
import SplashCursor from './bg/splash_cursor/SplashCursor';

export const EasterEgg = () => {
  const [easterEggCount, setEasterEggCount] = useAtom(easterEggCountAtom);
  const [rotate, setRotate] = useState(false);
  const [textEmoji, settextEmoji] = useAtom(easterEggKaomojiAtom);
  return (
    <>
      <button
        type="button"
        aria-label="Change playlist emoji"
        className={cn(
          'select-none border-0 bg-transparent p-0 text-sm text-muted-foreground hover:cursor-help',
          rotate && 'animate-spin'
        )}
        onClick={() => {
          setEasterEggCount(easterEggCount + 1);
          if (easterEggCount > 10) {
            setRotate(true);
            setEasterEggCount(0);
          } else {
            setRotate(false);
          }
          settextEmoji(get_text_emoji());
        }}
      >
        {textEmoji}
      </button>
      {rotate && <SplashCursor />}
    </>
  );
};
