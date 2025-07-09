import { FC, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

interface TitleTextProps {
  title: string;
}

const TitleText: FC<TitleTextProps> = ({ title }) => {
  const [theta, setTheta] = useState(0);
  const radius = 0.1;
  const speed = 0.01;

  useFrame(() => {
    setTheta((prevTheta) => prevTheta - speed);
  });

  return (
    <Html
      position={[Math.cos(theta) * radius, Math.sin(theta) * radius + 0.2, 0]}
      transform
    >
      <div className="text-xl font-bold text-white transition-all duration-100 hover:cursor-pointer">
        {title}
      </div>
    </Html>
  );
};

export default TitleText;
