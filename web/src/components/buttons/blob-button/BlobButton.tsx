import { FC } from 'react';

import styles from './BlobButton.module.css';

interface IBlobButton {
  title: string;
  link: string;
}

const circleStyle: Record<string, string> = {
  0: styles.circle__0,
  1: styles.circle__1,
  2: styles.circle__2,
  3: styles.circle__3,
  4: styles.circle__4,
};
const circles = Object.keys(circleStyle);

const BlobButton: FC<IBlobButton> = ({ title = 'Blob', link = '/' }) => {
  return (
    <>
      <div className={`relative overflow-hidden ${styles.circle}`}>
        {circles.map((circle) => {
          return (
            <div
              key={circle}
              className={`${styles.circle__main} ${circleStyle[circle]}`}
            ></div>
          );
        })}
        <a
          href={link}
          className="absolute flex h-48 w-48 cursor-pointer items-center justify-center rounded-full border border-transparent bg-opacity-0 text-xl font-bold text-primary-foreground transition-opacity hover:opacity-80"
          tabIndex={0}
        >
          {title}
        </a>
      </div>
    </>
  );
};

export default BlobButton;
