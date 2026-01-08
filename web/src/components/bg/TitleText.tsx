import { Html } from '@react-three/drei';

const TitleText = () => {
  return (
    <Html zIndexRange={[10]} center>
      <p className="text-xl font-bold text-primary-foreground hover:cursor-pointer">
        Save&nbsp;DW
      </p>
    </Html>
  );
};

export default TitleText;
