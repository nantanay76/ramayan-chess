import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import {
  flameMat,
  flameGlowMat,
  cityGlowMat,
  sandMat,
  cliffMat,
  rockMat,
  setuStoneMat,
  palmTrunkMat,
  palmLeafMat,
  towerMats,
  goldTrim,
} from './materials';

/** Environment meshes never take pointer events — clicks fall through to
 *  onPointerMissed, and the raycaster skips their (large) geometry. */
const noRaycast = () => null;

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// ---------------------------------------------------------------- sky + sun

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color('#161029') },
    midColor: { value: new THREE.Color('#5d3263') },
    botColor: { value: new THREE.Color('#ef8348') },
  },
  vertexShader: /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 topColor;
    uniform vec3 midColor;
    uniform vec3 botColor;
    varying vec3 vPos;
    void main() {
      float h = normalize(vPos).y;
      vec3 c = mix(botColor, midColor, smoothstep(-0.02, 0.22, h));
      c = mix(c, topColor, smoothstep(0.2, 0.65, h));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
});

function sunTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
  grad.addColorStop(0.25, 'rgba(255, 160, 80, 0.55)');
  grad.addColorStop(0.6, 'rgba(230, 100, 60, 0.18)');
  grad.addColorStop(1, 'rgba(230, 100, 60, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

const SUN_POS: [number, number, number] = [-19, 7.2, -52];

// ---------------------------------------------------------------- ocean

/**
 * Three gentle dusk swells. The GLSL below and waveHeightAt() must stay in
 * sync so floating diyas ride the same water the shader draws.
 */
function waveHeightAt(x: number, z: number, t: number): number {
  const y = -z; // ocean plane local +y maps to world -z
  return (
    0.075 * Math.sin(0.22 * (0.94 * x + 0.34 * y) + t * 0.55) +
    0.045 * Math.sin(0.42 * (-0.5 * x + 0.87 * y) + t * 0.9) +
    0.02 * Math.sin(0.9 * (0.17 * x - 0.98 * y) + t * 1.5)
  );
}

const oceanShader = new THREE.ShaderMaterial({
  fog: true,
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSunPos: { value: new THREE.Vector3(...SUN_POS) },
      uDeep: { value: new THREE.Color('#1d3560') },
      uLift: { value: new THREE.Color('#4a6fa5') },
      uSunColor: { value: new THREE.Color('#ff9a4d') },
    },
  ]),
  vertexShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vWorld;
    varying vec3 vNormalW;
    #include <fog_pars_vertex>

    void main() {
      vec2 p = position.xy;
      float t = uTime;
      float h = 0.0;
      vec2 dh = vec2(0.0);

      float ph1 = 0.22 * dot(vec2(0.94, 0.34), p) + t * 0.55;
      h += 0.075 * sin(ph1);
      dh += 0.075 * 0.22 * cos(ph1) * vec2(0.94, 0.34);

      float ph2 = 0.42 * dot(vec2(-0.5, 0.87), p) + t * 0.9;
      h += 0.045 * sin(ph2);
      dh += 0.045 * 0.42 * cos(ph2) * vec2(-0.5, 0.87);

      float ph3 = 0.9 * dot(vec2(0.17, -0.98), p) + t * 1.5;
      h += 0.02 * sin(ph3);
      dh += 0.02 * 0.9 * cos(ph3) * vec2(0.17, -0.98);

      vec3 pos = vec3(position.xy, position.z + h);
      vec3 nLocal = normalize(vec3(-dh, 1.0));
      vNormalW = normalize(mat3(modelMatrix) * nLocal);
      vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uDeep;
    uniform vec3 uLift;
    uniform vec3 uSunColor;
    uniform vec3 uSunPos;
    uniform float uTime;
    varying vec3 vWorld;
    varying vec3 vNormalW;
    #include <fog_pars_fragment>

    // cheap hash noise for a shimmering glitter path, not a solid beam
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec3 N = normalize(vNormalW);
      vec3 V = normalize(cameraPosition - vWorld);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
      vec3 col = mix(uDeep, uLift, clamp(fres, 0.0, 1.0));
      vec3 L = normalize(uSunPos - vWorld);
      vec3 H = normalize(L + V);
      float ndh = max(dot(N, H), 0.0);
      // broad soft sheen, kept faint so it never reads as a solid column
      float sheen = pow(ndh, 28.0) * 0.05;
      // tight glints, only lit where noise crosses a high threshold —
      // breaks the highlight into scattered sparkle instead of one beam
      float spec = pow(ndh, 260.0);
      float cell = hash(floor(vWorld.xz * 6.0) + floor(uTime * 2.0));
      float sparkle = spec * step(0.9, cell) * 1.8;
      col += uSunColor * (sheen + sparkle);
      gl_FragColor = vec4(col, 1.0);
      #include <fog_fragment>
    }
  `,
});

const sunDiscGeo = new THREE.CircleGeometry(2.4, 24);
const sunDiscMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false, toneMapped: false });

const SUN_GLOW_LAYERS = [
  { size: 14, opacity: 1 },
  { size: 26, opacity: 0.95 },
  { size: 46, opacity: 0.4 },
  { size: 76, opacity: 0.16 },
];
// low-tier devices keep the readable core + one halo — the 46/76-unit
// additive layers are pure fill-rate cost on portrait phones
const SUN_GLOW_LAYERS_LITE = [
  { size: 14, opacity: 1 },
  { size: 46, opacity: 0.5 },
];

function Ocean({ onSunMesh, segments, sunLayers }: {
  onSunMesh?: (m: THREE.Mesh | null) => void;
  segments: number;
  sunLayers: number;
}) {
  const sunRef = useRef<THREE.Group>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const sunWorld = useMemo(() => new THREE.Vector3(), []);
  const sunTex = useMemo(sunTexture, []);
  const glowLayers = sunLayers >= SUN_GLOW_LAYERS.length ? SUN_GLOW_LAYERS : SUN_GLOW_LAYERS_LITE;

  useFrame(({ clock, camera }) => {
    oceanShader.uniforms.uTime.value = clock.elapsedTime;
    if (sunRef.current) {
      sunRef.current.getWorldPosition(sunWorld);
      (oceanShader.uniforms.uSunPos.value as THREE.Vector3).copy(sunWorld);
    }
    // keep the god-rays anchor disc facing the camera (the rig can rotate it on flip)
    discRef.current?.lookAt(camera.position);
  });

  return (
    <group>
      <mesh material={oceanShader} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]} raycast={noRaycast}>
        <planeGeometry args={[170, 170, segments, segments]} />
      </mesh>
      {/* dusk sun low on the horizon — camera-facing glow layers (sprites,
          so the disc always reads as round instead of edge-on-ing into a streak) */}
      <group ref={sunRef} position={SUN_POS}>
        {glowLayers.map((l, i) => (
          <sprite key={i} scale={[l.size, l.size, 1]} raycast={noRaycast}>
            <spriteMaterial
              map={sunTex}
              transparent
              opacity={l.opacity}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              fog={false}
            />
          </sprite>
        ))}
        {/* plain mesh (sprites aren't supported) so GodRays has something to anchor to */}
        <mesh
          ref={(m) => {
            discRef.current = m;
            onSunMesh?.(m);
          }}
          geometry={sunDiscGeo}
          material={sunDiscMat}
          raycast={noRaycast}
        />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- lanka island (behind the black side)

function LankaIsland() {
  const cliffs = useMemo(() => {
    const rand = seededRand(11);
    const out: Array<{ p: [number, number, number]; r: number; h: number; ry: number }> = [];
    for (let i = 0; i < 7; i++) {
      const h = 7 + rand() * 7;
      out.push({
        p: [-30 + i * 7.6 + (rand() - 0.5) * 4, h / 2 - 2.2, -56 + (rand() - 0.5) * 7],
        r: 5 + rand() * 4,
        h,
        ry: rand() * Math.PI,
      });
    }
    return out;
  }, []);

  /** Gopuram-style towers: 2-4 stacked, tapering tiers each, so the skyline
   *  has real hierarchy instead of one box shape repeated. One dominant
   *  spire (Ravana's palace) anchors the composition. */
  const towers = useMemo(() => {
    const rand = seededRand(31);
    const PALACE_IDX = 4;
    const out: Array<{
      x: number;
      z: number;
      tierH: number[];
      tierW: number[];
      matIdx: number;
      isPalace: boolean;
    }> = [];
    for (let i = 0; i < 9; i++) {
      const isPalace = i === PALACE_IDX;
      const tierCount = isPalace ? 5 : 2 + Math.floor(rand() * 3);
      let w = isPalace ? 2.1 : 1.05 + rand() * 1.0;
      const tierH: number[] = [];
      const tierW: number[] = [];
      for (let t = 0; t < tierCount; t++) {
        tierH.push((isPalace ? 1.5 : 1.0 + rand() * 0.55) * (1 - t * 0.06));
        tierW.push(w);
        w *= isPalace ? 0.78 : 0.7 - rand() * 0.08;
      }
      out.push({
        x: -13 + i * 3.2 + (rand() - 0.5) * 1.3,
        z: -49 - rand() * 4.5 - (isPalace ? 2.5 : 0),
        tierH,
        tierW,
        matIdx: i % towerMats.length,
        isPalace,
      });
    }
    return out;
  }, []);

  return (
    <group>
      {/* island base */}
      <mesh material={cliffMat} position={[-4, -2.2, -54]} raycast={noRaycast}>
        <coneGeometry args={[30, 5, 24]} />
      </mesh>
      {cliffs.map((c, i) => (
        <mesh key={i} material={cliffMat} position={c.p} rotation={[0, c.ry, 0]} raycast={noRaycast}>
          <coneGeometry args={[c.r, c.h, 7]} />
        </mesh>
      ))}
      {/* the golden city of Lanka — a skyline of varied gopuram towers */}
      {towers.map((t, i) => {
        let y = 0.6;
        const tiers = t.tierH.map((h, ti) => {
          y += h / 2;
          const el = (
            <group key={ti}>
              <mesh material={towerMats[t.matIdx]} position={[t.x, y, t.z]} raycast={noRaycast}>
                <boxGeometry args={[t.tierW[ti], h, t.tierW[ti]]} />
              </mesh>
              <mesh material={goldTrim} position={[t.x, y + h / 2, t.z]} raycast={noRaycast}>
                <boxGeometry args={[t.tierW[ti] * 1.08, 0.07, t.tierW[ti] * 1.08]} />
              </mesh>
            </group>
          );
          y += h / 2;
          return el;
        });
        const roofW = t.tierW[t.tierW.length - 1];
        const roofH = t.isPalace ? 1.9 : 1.05 + (i % 3) * 0.15;
        return (
          <group key={i}>
            {tiers}
            <mesh material={goldTrim} position={[t.x, y + roofH / 2, t.z]} raycast={noRaycast}>
              <coneGeometry args={[roofW * 0.68, roofH, 8]} />
            </mesh>
            {t.isPalace && (
              <mesh material={goldTrim} position={[t.x, y + roofH + 0.45, t.z]} raycast={noRaycast}>
                <coneGeometry args={[0.12, 0.9, 6]} />
              </mesh>
            )}
          </group>
        );
      })}
      {/* warm rim-light so the skyline separates from the sky instead of
          reading as a flat cutout */}
      <pointLight position={[-2, 11, -45]} intensity={5} distance={42} decay={2} color="#ffb066" />
      <sprite material={cityGlowMat} position={[4, 6, -49]} scale={[40, 16, 1]} raycast={noRaycast} />
    </group>
  );
}

// ---------------------------------------------------------------- mainland shore (behind the white side)

function Palm({ x, z, lean, seed }: { x: number; z: number; lean: number; seed: number }) {
  const fronds = useMemo(() => {
    const rand = seededRand(seed);
    return Array.from({ length: 7 }, (_, i) => ({
      ry: (i / 7) * Math.PI * 2 + rand() * 0.5,
      droop: 0.35 + rand() * 0.45,
    }));
  }, [seed]);
  return (
    <group position={[x, -1.5, z]} rotation={[0, 0, lean]}>
      <mesh material={palmTrunkMat} position={[0, 2, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.12, 0.26, 4, 6]} />
      </mesh>
      <group position={[0, 4.05, 0]}>
        {fronds.map((f, i) => (
          // radial arm drooping below horizontal, leaf lying flat along it
          <group key={i} rotation={[0, f.ry, 0]}>
            <group rotation={[0, 0, -f.droop]}>
              <mesh material={palmLeafMat} position={[0.95, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noRaycast}>
                <planeGeometry args={[1.9, 0.5]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

function MainlandShore() {
  const rocks = useMemo(() => {
    const rand = seededRand(47);
    return Array.from({ length: 4 }, () => ({
      p: [-20 + rand() * 44, -1.6, 46 + rand() * 8] as [number, number, number],
      s: 0.8 + rand() * 1.6,
      ry: rand() * Math.PI,
    }));
  }, []);
  return (
    <group>
      {/* sandy beach mound */}
      <mesh material={sandMat} position={[0, -1.9, 52]} scale={[30, 2.6, 10]} raycast={noRaycast}>
        <sphereGeometry args={[1, 24, 12]} />
      </mesh>
      {rocks.map((r, i) => (
        <mesh key={i} material={rockMat} position={r.p} scale={r.s} rotation={[0, r.ry, 0.2]} raycast={noRaycast}>
          <dodecahedronGeometry args={[1.1, 0]} />
        </mesh>
      ))}
      <Palm x={-14} z={49} lean={0.16} seed={5} />
      <Palm x={-9} z={52} lean={-0.1} seed={17} />
      <Palm x={12} z={50} lean={0.08} seed={29} />
      <Palm x={17} z={47} lean={-0.2} seed={41} />
    </group>
  );
}

// ---------------------------------------------------------------- ram setu (floating stone causeway, mainland → lanka)

const setuStoneGeo = new THREE.DodecahedronGeometry(1, 0);

function RamSetu() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const COUNT = 26;
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rand = seededRand(97);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < COUNT; i++) {
      const t = i / (COUNT - 1);
      // quadratic bezier across the water on the east side
      const x = (1 - t) * (1 - t) * 19 + 2 * (1 - t) * t * 30 + t * t * 4;
      const z = (1 - t) * (1 - t) * 42 + 2 * (1 - t) * t * -6 + t * t * -56;
      e.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
      m.compose(
        new THREE.Vector3(x + (rand() - 0.5) * 2.4, -1.55 + rand() * 0.3, z + (rand() - 0.5) * 2.4),
        q.setFromEuler(e),
        new THREE.Vector3(1.1 + rand() * 1.3, 0.35 + rand() * 0.2, 0.8 + rand() * 0.9),
      );
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[setuStoneGeo, setuStoneMat, COUNT]} raycast={noRaycast} />;
}

// ---------------------------------------------------------------- floating diyas

const DIYAS: Array<[number, number, number]> = (() => {
  const rand = seededRand(7);
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.5;
    const r = 10 + rand() * 9;
    out.push([Math.cos(a) * r, rand() * Math.PI * 2, Math.sin(a) * r]);
  }
  return out;
})();

const diyaBowlGeo = new THREE.CylinderGeometry(0.16, 0.09, 0.1, 10);
const diyaFlameGeo = new THREE.SphereGeometry(0.07, 8, 8);
const diyaBowlMat = new THREE.MeshLambertMaterial({ color: '#5b3a22' });

function FloatingDiyas() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((child, i) => {
      child.position.y = -1.36 + waveHeightAt(DIYAS[i][0], DIYAS[i][2], t);
    });
  });
  return (
    <group ref={ref}>
      {DIYAS.map(([x, , z], i) => (
        <group key={i} position={[x, -1.36, z]}>
          <mesh geometry={diyaBowlGeo} material={diyaBowlMat} raycast={noRaycast} />
          <mesh geometry={diyaFlameGeo} material={flameMat} position={[0, 0.1, 0]} raycast={noRaycast} />
          <sprite material={flameGlowMat} position={[0, 0.12, 0]} scale={[0.85, 0.85, 1]} raycast={noRaycast} />
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- assembly

export function Environment({ onSunMesh, oceanSegments = 110, sunLayers = 4 }: {
  onSunMesh?: (m: THREE.Mesh | null) => void;
  oceanSegments?: number;
  sunLayers?: number;
}) {
  return (
    <group>
      <mesh material={skyMat} raycast={noRaycast}>
        <sphereGeometry args={[70, 32, 20]} />
      </mesh>
      <Stars radius={55} depth={25} count={1200} factor={3} saturation={0} fade speed={0.4} />
      <Ocean onSunMesh={onSunMesh} segments={oceanSegments} sunLayers={sunLayers} />
      <LankaIsland />
      <MainlandShore />
      <RamSetu />
      <FloatingDiyas />
    </group>
  );
}
