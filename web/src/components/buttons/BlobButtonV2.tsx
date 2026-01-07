import { FC } from 'react';
import Silk from '../bg/Silk';

interface IBlobButton {
  link: string;
}

const BlobButton: FC<IBlobButton> = ({ link = '/' }) => {
  return (
    <div className="rounded-full">
      <a href={link} tabIndex={0}>
        <Silk />
      </a>
    </div>
  );
};

export default BlobButton;
