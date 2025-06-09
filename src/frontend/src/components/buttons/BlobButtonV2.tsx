import { FC } from 'react';
import Silk from '../bg/Silk';

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
      <Silk
        speed={5}
        scale={1}
        color="#7B7481"
        noiseIntensity={1.5}
        rotation={0}
      />
    </div>
  );
};

export default BlobButton;
