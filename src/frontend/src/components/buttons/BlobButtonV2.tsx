import { FC } from 'react';

interface IBlobButton {
  title: string;
  link: string;
}

const BlobButton: FC<IBlobButton> = ({ title = 'Blob', link = '/' }) => {
  return (
    <div className="relative">
      <a
        href={link}
        className="bg-opacity-0 text-xl font-bold text-primary-foreground transition-opacity hover:opacity-80"
        tabIndex={0}
      >
        {title}
      </a>
    </div>
  );
};

export default BlobButton;
