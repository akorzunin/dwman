import { useState } from 'react';
import { get_text_emoji } from '../utils/utils';
import { useAtom } from 'jotai';
import { easterEggCountAtom } from '../store/store';
import { cn } from '../lib/utils';

export const EasterEgg = () => {
  const [easterEggCount, setEasterEggCount] = useAtom(easterEggCountAtom);
  const [rotate, setRotate] = useState(false);
  const [textEmoji, settextEmoji] = useState(get_text_emoji());
  return (
    <span
      className={cn(
        'select-none text-sm text-muted-foreground hover:cursor-help',
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
    </span>
  );
};
