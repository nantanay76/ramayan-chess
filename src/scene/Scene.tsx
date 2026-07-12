import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useGame } from '../store';
import { Board } from './Board';
import { Pieces } from './Pieces';
import { Environment } from './Environment';

export function Scene() {
  const clearSelection = useGame((s) => s.clearSelection);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [0, 7.4, 8.8], fov: 42 }}
      onPointerMissed={clearSelection}
    >
      <fog attach="fog" args={['#241536', 34, 95]} />
      <ambientLight intensity={0.55} color="#ffd9b0" />
      <directionalLight
        position={[6, 12, 5]}
        intensity={1.5}
        color="#ffe3c2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-far={40}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#7d9bff" />
      <Environment />
      <Board />
      <Pieces />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={6.5}
        maxDistance={18}
        minPolarAngle={0.15}
        maxPolarAngle={1.35}
        enableDamping
        dampingFactor={0.08}
      />
      <EffectComposer>
        <Bloom luminanceThreshold={1} mipmapBlur intensity={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
