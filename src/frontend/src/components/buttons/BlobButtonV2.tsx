import { FC } from 'react';
import Silk from '../bg/Silk';

interface IBlobButton {
  title: string;
  link: string;
}

const BlobButton: FC<IBlobButton> = ({ title = 'Blob', link = '/' }) => {
  return (
    <div className="rounded-full">
      <a href={link} tabIndex={0}>
        <Silk
          speed={5}
          scale={1}
          color="#7B7481"
          noiseIntensity={1.5}
          rotation={0}
          title={title}
        />
      </a>
    </div>
  );
};

export default BlobButton;
