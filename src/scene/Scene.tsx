import { Suspense, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, GodRays, Vignette } from '@react-three/postprocessing';
import { useGame } from '../store';
import { Board, EdgeLabels } from './Board';
import { Pieces } from './Pieces';
import { Environment } from './Environment';

/**
 * The camera never moves during play — one cinematic angle, re-framed only
 * when the viewport aspect changes (portrait phones pull back and widen).
 * Steeper, closer, and centered on the board so every rank reads clearly and
 * the board — not the horizon — dominates the frame.
 */
const LOOK_AT = new THREE.Vector3(0, 0.5, -2.1);
const PITCH = (26 * Math.PI) / 180; // top-leaning, chess.com-style read of the board

function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const fov = aspect < 1 ? 52 : 46;
    // pull back until the board (~10.6 units with border) fits horizontally
    const tanH = Math.tan((fov * Math.PI) / 360) * aspect;
    const dist = Math.min(24, Math.max(16, 5.15 / tanH));
    camera.position
      .set(0, Math.sin(PITCH), Math.cos(PITCH))
      .multiplyScalar(dist)
      .add(LOOK_AT);
    camera.fov = fov;
    camera.lookAt(LOOK_AT);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const FLIP_SECONDS = 0.85;

/** Board + pieces rotate together; Flip is an eased half-turn of this group. */
function BoardRig({ children }: { children: React.ReactNode }) {
  const flipped = useGame((s) => s.flipped);
  const ref = useRef<THREE.Group>(null);
  const anim = useRef({ from: 0, to: 0, t: 1 });
  const mounted = useRef(false);

  useEffect(() => {
    const to = flipped ? Math.PI : 0;
    if (!mounted.current) {
      // first render (e.g. starting a game as Lanka): snap, don't animate
      mounted.current = true;
      anim.current = { from: to, to, t: 1 };
      if (ref.current) ref.current.rotation.y = to;
      return;
    }
    anim.current = { from: ref.current?.rotation.y ?? 0, to, t: 0 };
  }, [flipped]);

  useFrame((_, dt) => {
    const a = anim.current;
    const g = ref.current;
    if (!g || a.t >= 1) return;
    a.t = Math.min(1, a.t + dt / FLIP_SECONDS);
    g.rotation.y = a.from + (a.to - a.from) * easeInOutCubic(a.t);
  });

  return <group ref={ref}>{children}</group>;
}

/** Best-effort real light-shafts anchored to the sun mesh Environment reports
 *  up via onSunMesh — falls back to just Bloom + Vignette until it mounts. */
function Effects({ sunMesh }: { sunMesh: THREE.Mesh | null }) {
  const effects = useMemo(() => {
    const list = [
      <Bloom key="bloom" luminanceThreshold={0.55} luminanceSmoothing={0.25} intensity={0.5} mipmapBlur />,
      sunMesh && (
        <GodRays
          key="godrays"
          sun={sunMesh}
          density={0.85}
          decay={0.9}
          weight={0.35}
          exposure={0.27}
          samples={30}
          resolutionScale={0.5}
          clampMax={1}
          blur
        />
      ),
      <Vignette key="vignette" eskil={false} offset={0.18} darkness={0.65} />,
    ].filter(Boolean) as ReactElement[];
    return list;
  }, [sunMesh]);

  return (
    // resolutionScale keeps the (expensive) post-processing passes cheap on
    // modest GPUs without softening the main 3D render, which stays at the
    // Canvas's own dpr.
    <EffectComposer multisampling={0} enableNormalPass={false} resolutionScale={0.75}>
      {effects}
    </EffectComposer>
  );
}

export function Scene() {
  const clearSelection = useGame((s) => s.clearSelection);
  const [dpr, setDpr] = useState(() => Math.min(1.5, window.devicePixelRatio));
  const [sunMesh, setSunMesh] = useState<THREE.Mesh | null>(null);
  // PerformanceMonitor's first sample window would otherwise land squarely on
  // the one-time startup hitch (shader compile + GLB decode) and read that as
  // sustained bad performance — mount it only once that's behind us, so it
  // judges steady-state rendering instead of the cold start.
  const [monitorReady, setMonitorReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMonitorReady(true), 2500);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="scene-wrap">
      <Canvas
        shadows
        dpr={dpr}
        camera={{ position: [0, 7.4, 8.8], fov: 42 }}
        onPointerMissed={clearSelection}
      >
        {monitorReady && (
          <PerformanceMonitor
            flipflops={3}
            onDecline={() => setDpr(1)}
            onIncline={() => setDpr(Math.min(1.5, window.devicePixelRatio))}
            onFallback={() => setDpr(1)}
          />
        )}
        <CameraRig />
        <fog attach="fog" args={['#241536', 30, 120]} />
        <ambientLight intensity={0.55} color="#ffd9b0" />
        <directionalLight
          position={[6, 12, 5]}
          intensity={1.5}
          color="#ffe3c2"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-7}
          shadow-camera-right={7}
          shadow-camera-top={7}
          shadow-camera-bottom={-7}
          shadow-camera-far={40}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#7d9bff" />
        {/* environment rides the rig too: Lanka rises behind the demon army,
            the mainland shore behind Ram's — whichever side you play */}
        <BoardRig>
          <Environment onSunMesh={setSunMesh} />
          <Board />
          <Suspense fallback={null}>
            <Pieces />
          </Suspense>
        </BoardRig>
        <EdgeLabels />
        <Effects sunMesh={sunMesh} />
      </Canvas>
    </div>
  );
}
