/// <reference types="vite-plugin-glsl/ext" />
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Color } from 'three';
import TitleText from './TitleText';
import { ThemeValues, useTheme } from '../../shadcn/ui/theme-provider';

import vertexShader from './silk.vert';
import fragmentShader from './silk.frag';

const colorMap: Record<ThemeValues, Color> = {
  light: new Color('rgb(125, 211, 252)'),
  dark: new Color('rgb(2, 132, 199)'),
  system: new Color('rgb(14, 165, 233)'),
  'office-light': new Color('rgb(125, 211, 252)'),
  'office-dark': new Color('rgb(2, 132, 199)'),
  'pepega-green': new Color('green'),
  'rose-pine': new Color('purple'),
};

function SilkPlane() {
  const ref = useRef();
  const th = useTheme();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor: { value: colorMap[th.theme] },
    }),
    []
  );
  useFrame((state) => {
    const { clock } = state;
    if (!ref.current) return;
    // @ts-expect-error ts(2339)
    const u = ref.current.material.uniforms;
    u.uTime.value = clock.getElapsedTime();
    u.uColor.value = colorMap[th.theme];
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[8, 8]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </mesh>
  );
}

const Silk = () => {
  return (
    <div className="h-[300px] w-[300px] overflow-hidden rounded-full">
      <Canvas>
        <TitleText />
        <SilkPlane />
      </Canvas>
    </div>
  );
};

export default Silk;
