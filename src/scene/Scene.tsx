import { Suspense, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, Bloom, GodRays, Vignette } from '@react-three/postprocessing';
import { useGame } from '../store';
import { Board, EdgeLabels } from './Board';
import { Pieces } from './Pieces';
import { Environment } from './Environment';
import { StudioEnv } from './StudioEnv';

/**
 * The cinematic camera never moves on its own during play — re-framed only
 * when the viewport aspect changes (portrait phones pull back and widen), or
 * eased to/from the top-down view via the HUD toggle. Steeper, closer, and
 * centered on the board so every rank reads clearly and the board — not the
 * horizon — dominates the frame.
 */
const LOOK_AT = new THREE.Vector3(0, 0.5, -2.1);
const PITCH = (26 * Math.PI) / 180; // top-leaning, chess.com-style read of the board

const TOP_LOOK_AT = new THREE.Vector3(0, 0, 0);
// Kept short of 90°: at a true 90° pitch the camera's forward vector runs
// parallel to world-up, which makes lookAt()'s internal right = up × forward
// go degenerate — the board's on-screen roll becomes unstable frame to
// frame, not just harder to read.
const TOP_PITCH = (82 * Math.PI) / 180;
const CAMERA_SECONDS = 0.75;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

interface CameraTarget {
  pos: THREE.Vector3;
  fov: number;
  lookAt: THREE.Vector3;
}

function cinematicTarget(aspect: number): CameraTarget {
  const fov = aspect < 1 ? 52 : 46;
  // pull back until the board (~10.6 units with border) fits horizontally
  const tanH = Math.tan((fov * Math.PI) / 360) * aspect;
  const dist = Math.min(24, Math.max(16, 5.15 / tanH));
  const pos = new THREE.Vector3(0, Math.sin(PITCH), Math.cos(PITCH)).multiplyScalar(dist).add(LOOK_AT);
  return { pos, fov, lookAt: LOOK_AT };
}

function topDownTarget(aspect: number): CameraTarget {
  const fov = aspect < 1 ? 52 : 46;
  const tanV = Math.tan((fov * Math.PI) / 360);
  // near-90° pitch means either axis can be the binding one depending on
  // orientation, unlike the oblique cinematic angle where horizontal always
  // is — so pick whichever axis is tighter instead of reusing that formula.
  const dist = Math.min(30, Math.max(15, 5.65 / (tanV * Math.min(1, aspect))));
  const pos = new THREE.Vector3(0, Math.sin(TOP_PITCH), Math.cos(TOP_PITCH)).multiplyScalar(dist).add(TOP_LOOK_AT);
  return { pos, fov, lookAt: TOP_LOOK_AT };
}

function lerpCameraTarget(a: CameraTarget, b: CameraTarget, t: number): CameraTarget {
  return {
    pos: a.pos.clone().lerp(b.pos, t),
    fov: a.fov + (b.fov - a.fov) * t,
    lookAt: a.lookAt.clone().lerp(b.lookAt, t),
  };
}

function applyCameraTarget(camera: THREE.PerspectiveCamera, target: CameraTarget) {
  camera.position.copy(target.pos);
  camera.fov = target.fov;
  camera.lookAt(target.lookAt);
  camera.updateProjectionMatrix();
}

function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const topDown = useGame((s) => s.topDownView);
  const mounted = useRef(false);
  const lastTopDown = useRef(topDown);
  const anim = useRef({ from: cinematicTarget(1), to: cinematicTarget(1), t: 1 });

  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const target = topDown ? topDownTarget(aspect) : cinematicTarget(aspect);

    if (!mounted.current) {
      mounted.current = true;
      lastTopDown.current = topDown;
      anim.current = { from: target, to: target, t: 1 };
      applyCameraTarget(camera, target);
      return;
    }

    if (topDown === lastTopDown.current) {
      // resize only — snap, this isn't a user-facing "switch"
      anim.current = { from: target, to: target, t: 1 };
      applyCameraTarget(camera, target);
      return;
    }

    lastTopDown.current = topDown;
    const a = anim.current;
    // blend from the currently-interpolated point, not the mutable camera
    // object, so interrupting a still-running transition doesn't jump
    const current = lerpCameraTarget(a.from, a.to, easeInOutCubic(a.t));
    anim.current = { from: current, to: target, t: 0 };
  }, [camera, size, topDown]);

  useFrame((_, dt) => {
    const a = anim.current;
    if (a.t >= 1) return;
    a.t = Math.min(1, a.t + dt / CAMERA_SECONDS);
    applyCameraTarget(camera, lerpCameraTarget(a.from, a.to, easeInOutCubic(a.t)));
  });

  return null;
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
function Effects({ sunMesh, resolutionScale, godRaySamples }: {
  sunMesh: THREE.Mesh | null;
  resolutionScale: number;
  godRaySamples: number;
}) {
  const effects = useMemo(() => {
    const list = [
      <Bloom key="bloom" luminanceThreshold={0.55} luminanceSmoothing={0.25} intensity={0.5} mipmapBlur />,
      godRaySamples > 0 && sunMesh && (
        <GodRays
          key="godrays"
          sun={sunMesh}
          density={0.85}
          decay={0.9}
          weight={0.35}
          exposure={0.27}
          samples={godRaySamples}
          resolutionScale={0.5}
          clampMax={1}
          blur
        />
      ),
      <Vignette key="vignette" eskil={false} offset={0.18} darkness={0.65} />,
    ].filter(Boolean) as ReactElement[];
    return list;
  }, [sunMesh, godRaySamples]);

  return (
    // resolutionScale keeps the (expensive) post-processing passes cheap on
    // modest GPUs without softening the main 3D render, which stays at the
    // Canvas's own dpr — tied to the same quality tier as shadows/dpr so it
    // scales down with everything else instead of being a flat, permanent tax.
    <EffectComposer multisampling={0} enableNormalPass={false} resolutionScale={resolutionScale}>
      {effects}
    </EffectComposer>
  );
}

interface QualityTier {
  dprCap: number;
  shadows: 'soft' | 'percentage' | 'basic';
  /** false = skip the shadow pass entirely (the light stops casting). */
  castShadow: boolean;
  shadowMapSize: number;
  /** false = no EffectComposer at all — scene renders straight to canvas. */
  composer: boolean;
  postScale: number;
  /** 0 = drop the GodRays pass (the heaviest effect). */
  godRaySamples: number;
  oceanSegments: number;
  sunLayers: number;
}

const QUALITY_TIERS: QualityTier[] = [
  { dprCap: 1.5, shadows: 'soft', castShadow: true, shadowMapSize: 1024, composer: true, postScale: 1, godRaySamples: 30, oceanSegments: 110, sunLayers: 4 },
  { dprCap: 1.25, shadows: 'percentage', castShadow: true, shadowMapSize: 1024, composer: true, postScale: 0.75, godRaySamples: 20, oceanSegments: 110, sunLayers: 4 },
  { dprCap: 1, shadows: 'basic', castShadow: true, shadowMapSize: 512, composer: true, postScale: 0.5, godRaySamples: 0, oceanSegments: 64, sunLayers: 2 },
  { dprCap: 1, shadows: 'basic', castShadow: false, shadowMapSize: 256, composer: false, postScale: 0.5, godRaySamples: 0, oceanSegments: 48, sunLayers: 2 },
];

/** Phones start one notch down and let PerformanceMonitor climb back up —
 *  cheaper than burning the first seconds at full quality on a weak GPU. */
function initialTier(): number {
  const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  type UAData = { userAgentData?: { mobile?: boolean } };
  const uaMobile = (navigator as UAData).userAgentData?.mobile === true;
  return coarse || uaMobile ? 2 : 0;
}

/** Shadow map only reallocates when light.shadow.map is null — three.js
 *  won't resize an already-allocated map just because shadow-mapSize changed. */
function ShadowSun({ mapSize, castShadow }: { mapSize: number; castShadow: boolean }) {
  const ref = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const light = ref.current;
    if (!light) return;
    light.shadow.map?.dispose();
    light.shadow.map = null;
  }, [mapSize]);
  return (
    <directionalLight
      ref={ref}
      position={[6, 12, 5]}
      intensity={1.5}
      color="#ffe3c2"
      castShadow={castShadow}
      shadow-mapSize={[mapSize, mapSize]}
      shadow-camera-left={-7}
      shadow-camera-right={7}
      shadow-camera-top={7}
      shadow-camera-bottom={-7}
      shadow-camera-far={40}
      shadow-bias={-0.0004}
    />
  );
}

/** Dev-only: window.__perf() → draw calls/triangles, window.__setTier(n|null)
 *  → pin a quality tier, for before/after measurements in tests. */
function PerfProbe({ forceTier }: { forceTier: (t: number | null) => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__perf = () => ({ ...gl.info.render, programs: gl.info.programs?.length ?? 0 });
    w.__setTier = forceTier;
    return () => {
      delete w.__perf;
      delete w.__setTier;
    };
  }, [gl, forceTier]);
  return null;
}

export function Scene() {
  const clearSelection = useGame((s) => s.clearSelection);
  const [qualityTier, setQualityTier] = useState(initialTier);
  const [forcedTier, setForcedTier] = useState<number | null>(null);
  const tier = QUALITY_TIERS[forcedTier ?? qualityTier];
  const dpr = Math.min(tier.dprCap, window.devicePixelRatio);
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
        shadows={tier.shadows}
        dpr={dpr}
        // hybrid-GPU laptops otherwise often hand WebGL to the integrated GPU
        gl={{ powerPreference: 'high-performance' }}
        camera={{ position: [0, 7.4, 8.8], fov: 42 }}
        onPointerMissed={clearSelection}
      >
        <PerfProbe forceTier={setForcedTier} />
        <StudioEnv intensity={0.45} />
        {monitorReady && forcedTier === null && (
          // flipflops/onFallback are intentionally left at their drei
          // defaults (Infinity/unused): the default lets the monitor keep
          // adapting for the whole session. Passing flipflops permanently
          // freezes quality at whatever tier is active once enough
          // adjustments happen, with no way back — that was the bug.
          <PerformanceMonitor
            onIncline={() => setQualityTier((t) => Math.max(0, t - 1))}
            onDecline={() => setQualityTier((t) => Math.min(QUALITY_TIERS.length - 1, t + 1))}
          />
        )}
        <CameraRig />
        <fog attach="fog" args={['#241536', 30, 120]} />
        {/* dropped from 0.55 when StudioEnv IBL was added — combined they wash out */}
        <ambientLight intensity={0.42} color="#ffd9b0" />
        <ShadowSun mapSize={tier.shadowMapSize} castShadow={tier.castShadow} />
        <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#7d9bff" />
        {/* environment rides the rig too: Lanka rises behind the demon army,
            the mainland shore behind Ram's — whichever side you play */}
        <BoardRig>
          <Environment onSunMesh={setSunMesh} oceanSegments={tier.oceanSegments} sunLayers={tier.sunLayers} />
          <Board />
          <Suspense fallback={null}>
            <Pieces />
          </Suspense>
        </BoardRig>
        <EdgeLabels />
        {tier.composer && (
          <Effects sunMesh={sunMesh} resolutionScale={tier.postScale} godRaySamples={tier.godRaySamples} />
        )}
      </Canvas>
    </div>
  );
}
