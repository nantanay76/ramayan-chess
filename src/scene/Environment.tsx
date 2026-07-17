import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  moonMat,
  moonGlowMat,
  cloudMats,
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
      uMoonPos: { value: new THREE.Vector3(26, 14, 38) },
      uDeep: { value: new THREE.Color('#1d3560') },
      uLift: { value: new THREE.Color('#4a6fa5') },
      uSunColor: { value: new THREE.Color('#ff9a4d') },
      uMoonColor: { value: new THREE.Color('#bcd0ff') },
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
    uniform vec3 uMoonPos;
    uniform vec3 uMoonColor;
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
      // cool moonlit counterpart, fainter and out of sync with the sun path,
      // so the flipped (mainland-facing) view gets its own living water
      vec3 Lm = normalize(uMoonPos - vWorld);
      vec3 Hm = normalize(Lm + V);
      float ndhm = max(dot(N, Hm), 0.0);
      float msheen = pow(ndhm, 28.0) * 0.035;
      float mspec = pow(ndhm, 240.0);
      float mcell = hash(floor(vWorld.xz * 6.0) + floor(uTime * 2.0) + vec2(7.3, 3.1));
      float msparkle = mspec * step(0.88, mcell) * 1.2;
      col += uMoonColor * (msheen + msparkle);
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

function Ocean({ onSunMesh, segments, sunLayers, moonGlow }: {
  onSunMesh?: (m: THREE.Mesh | null) => void;
  segments: number;
  sunLayers: number;
  moonGlow: boolean;
}) {
  const sunRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Group>(null);
  const discRef = useRef<THREE.Mesh>(null);
  const sunWorld = useMemo(() => new THREE.Vector3(), []);
  const moonWorld = useMemo(() => new THREE.Vector3(), []);
  const sunTex = useMemo(sunTexture, []);
  const glowLayers = sunLayers >= SUN_GLOW_LAYERS.length ? SUN_GLOW_LAYERS : SUN_GLOW_LAYERS_LITE;

  useFrame(({ clock, camera }) => {
    oceanShader.uniforms.uTime.value = clock.elapsedTime;
    if (sunRef.current) {
      sunRef.current.getWorldPosition(sunWorld);
      (oceanShader.uniforms.uSunPos.value as THREE.Vector3).copy(sunWorld);
    }
    if (moonRef.current) {
      moonRef.current.getWorldPosition(moonWorld);
      (oceanShader.uniforms.uMoonPos.value as THREE.Vector3).copy(moonWorld);
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
      {/* rising moon over the mainland — the counterweight to the dusk sun,
          and the light source the shader's second glitter path tracks. Kept
          just above the waterline: the cinematic camera pitches 26° down, so
          anything much above eye level (~y 4.5 at this distance) never enters
          the frame — a low sea-moon is the only moon the player can see */}
      <group ref={moonRef} position={[26, 3.8, 42]}>
        {moonGlow && <sprite material={moonGlowMat} scale={[12, 12, 1]} raycast={noRaycast} />}
        <sprite material={moonMat} scale={[3.2, 3.2, 1]} raycast={noRaycast} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- clouds

const CLOUDS: Array<{ a: number; r: number; y: number; w: number; h: number; m: number }> = (() => {
  const rand = seededRand(59);
  return Array.from({ length: 6 }, (_, i) => ({
    a: (i / 6) * Math.PI * 2 + rand() * 0.7,
    r: 52 + rand() * 12,
    y: 8 + rand() * 6,
    w: 18 + rand() * 12,
    h: 5 + rand() * 2.5,
    m: i % cloudMats.length,
  }));
})();

/** Slow dusk clouds around the horizon; the whole ring drifts as one group. */
function DriftingClouds() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004;
  });
  return (
    <group ref={ref}>
      {CLOUDS.map((c, i) => (
        <sprite
          key={i}
          material={cloudMats[c.m]}
          position={[Math.cos(c.a) * c.r, c.y, Math.sin(c.a) * c.r]}
          scale={[c.w, c.h, 1]}
          raycast={noRaycast}
        />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- lanka island (behind the black side)

/** Everything on the island is static, so each material's meshes are merged
 *  into ONE geometry — the whole skyline (base + 7 cliffs + 9 multi-tier
 *  gopuram towers + trims/roofs) renders in ~6 draw calls instead of ~80.
 *  The rand() call order below must stay exactly as the original per-mesh
 *  version so the silhouette is pixel-identical. */
function LankaIsland() {
  const merged = useMemo(() => {
    // cliffs + island base → one geometry on cliffMat
    const cliffGeos: THREE.BufferGeometry[] = [];
    const base = new THREE.ConeGeometry(30, 5, 24);
    base.translate(-4, -2.2, -54);
    cliffGeos.push(base);
    {
      const rand = seededRand(11);
      for (let i = 0; i < 7; i++) {
        const h = 7 + rand() * 7;
        const px = -30 + i * 7.6 + (rand() - 0.5) * 4;
        const pz = -56 + (rand() - 0.5) * 7;
        const r = 5 + rand() * 4;
        const ry = rand() * Math.PI;
        const g = new THREE.ConeGeometry(r, h, 7);
        g.rotateY(ry);
        g.translate(px, h / 2 - 2.2, pz);
        cliffGeos.push(g);
      }
    }

    // gopuram towers: tiers grouped per window-texture material, trims/roofs on gold
    const byTowerMat: THREE.BufferGeometry[][] = towerMats.map(() => []);
    const goldGeos: THREE.BufferGeometry[] = [];
    {
      const rand = seededRand(31);
      const PALACE_IDX = 4;
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
        const x = -13 + i * 3.2 + (rand() - 0.5) * 1.3;
        const z = -49 - rand() * 4.5 - (isPalace ? 2.5 : 0);
        const matIdx = i % towerMats.length;

        let y = 0.6;
        tierH.forEach((h, ti) => {
          y += h / 2;
          const tier = new THREE.BoxGeometry(tierW[ti], h, tierW[ti]);
          tier.translate(x, y, z);
          byTowerMat[matIdx].push(tier);
          const trim = new THREE.BoxGeometry(tierW[ti] * 1.08, 0.07, tierW[ti] * 1.08);
          trim.translate(x, y + h / 2, z);
          goldGeos.push(trim);
          y += h / 2;
        });
        const roofW = tierW[tierW.length - 1];
        const roofH = isPalace ? 1.9 : 1.05 + (i % 3) * 0.15;
        const roof = new THREE.ConeGeometry(roofW * 0.68, roofH, 8);
        roof.translate(x, y + roofH / 2, z);
        goldGeos.push(roof);
        if (isPalace) {
          const spire = new THREE.ConeGeometry(0.12, 0.9, 6);
          spire.translate(x, y + roofH + 0.45, z);
          goldGeos.push(spire);
        }
      }
    }

    const cliff = mergeGeometries(cliffGeos)!;
    const towers = byTowerMat.map((gs) => mergeGeometries(gs)!);
    const gold = mergeGeometries(goldGeos)!;
    [...cliffGeos, ...byTowerMat.flat(), ...goldGeos].forEach((g) => g.dispose());
    return { cliff, towers, gold };
  }, []);

  useEffect(
    () => () => {
      merged.cliff.dispose();
      merged.towers.forEach((g) => g.dispose());
      merged.gold.dispose();
    },
    [merged],
  );

  return (
    <group>
      <mesh geometry={merged.cliff} material={cliffMat} raycast={noRaycast} />
      {merged.towers.map((g, i) => (
        <mesh key={i} geometry={g} material={towerMats[i]} raycast={noRaycast} />
      ))}
      <mesh geometry={merged.gold} material={goldTrim} raycast={noRaycast} />
      {/* warm rim-light so the skyline separates from the sky instead of
          reading as a flat cutout */}
      <pointLight position={[-2, 11, -45]} intensity={5} distance={42} decay={2} color="#ffb066" />
      <sprite material={cityGlowMat} position={[4, 6, -49]} scale={[40, 16, 1]} raycast={noRaycast} />
    </group>
  );
}

// ---------------------------------------------------------------- mainland shore (behind the white side)

const PALMS = [
  { x: -14, z: 49, lean: 0.16, seed: 5 },
  { x: -9, z: 52, lean: -0.1, seed: 17 },
  { x: 12, z: 50, lean: 0.08, seed: 29 },
  { x: 17, z: 47, lean: -0.2, seed: 41 },
];

/** Static shore scenery merged per material: 4 rocks → 1 draw, 4 trunks → 1,
 *  28 frond planes → 1 (was ~37 draw calls, now 4 with the sand mound). */
function MainlandShore() {
  const merged = useMemo(() => {
    const rockGeos: THREE.BufferGeometry[] = [];
    {
      const rand = seededRand(47);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Vector3(-20 + rand() * 44, -1.6, 46 + rand() * 8);
        const s = 0.8 + rand() * 1.6;
        const ry = rand() * Math.PI;
        const g = new THREE.DodecahedronGeometry(1.1, 0);
        m.compose(p, q.setFromEuler(new THREE.Euler(0, ry, 0.2)), new THREE.Vector3(s, s, s));
        g.applyMatrix4(m);
        rockGeos.push(g);
      }
    }

    const trunkGeos: THREE.BufferGeometry[] = [];
    const leafGeos: THREE.BufferGeometry[] = [];
    const groupM = new THREE.Matrix4();
    const rotM = new THREE.Matrix4();
    for (const p of PALMS) {
      // group transform: translate(x, -1.5, z) ∘ rotateZ(lean)
      groupM.makeRotationZ(p.lean).setPosition(p.x, -1.5, p.z);
      const trunk = new THREE.CylinderGeometry(0.12, 0.26, 4, 6);
      trunk.translate(0, 2, 0);
      trunk.applyMatrix4(groupM);
      trunkGeos.push(trunk);
      const rand = seededRand(p.seed);
      for (let i = 0; i < 7; i++) {
        // radial arm drooping below horizontal, leaf lying flat along it
        const ry = (i / 7) * Math.PI * 2 + rand() * 0.5;
        const droop = 0.35 + rand() * 0.45;
        const leaf = new THREE.PlaneGeometry(1.9, 0.5);
        leaf.rotateX(-Math.PI / 2);
        leaf.translate(0.95, 0, 0);
        leaf.applyMatrix4(rotM.makeRotationZ(-droop));
        leaf.applyMatrix4(rotM.makeRotationY(ry));
        leaf.translate(0, 4.05, 0);
        leaf.applyMatrix4(groupM);
        leafGeos.push(leaf);
      }
    }

    const rocks = mergeGeometries(rockGeos)!;
    const trunks = mergeGeometries(trunkGeos)!;
    const leaves = mergeGeometries(leafGeos)!;
    [...rockGeos, ...trunkGeos, ...leafGeos].forEach((g) => g.dispose());
    return { rocks, trunks, leaves };
  }, []);

  useEffect(
    () => () => {
      merged.rocks.dispose();
      merged.trunks.dispose();
      merged.leaves.dispose();
    },
    [merged],
  );

  return (
    <group>
      {/* sandy beach mound */}
      <mesh material={sandMat} position={[0, -1.9, 52]} scale={[30, 2.6, 10]} raycast={noRaycast}>
        <sphereGeometry args={[1, 24, 12]} />
      </mesh>
      <mesh geometry={merged.rocks} material={rockMat} raycast={noRaycast} />
      <mesh geometry={merged.trunks} material={palmTrunkMat} raycast={noRaycast} />
      <mesh geometry={merged.leaves} material={palmLeafMat} raycast={noRaycast} />
      {/* Vanara army campfires among the palms — the shore's answer to
          Lanka's glowing windows */}
      {[
        [-12, -1.15, 47.5],
        [2.5, -1.2, 50],
        [15, -1.15, 46.5],
      ].map((p, i) => (
        <sprite
          key={i}
          material={flameGlowMat}
          position={p as [number, number, number]}
          scale={[1.7, 1.7, 1]}
          raycast={noRaycast}
        />
      ))}
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

// ponytail: diyas bob per-frame so they stay individual objects (~40 calls);
// instance them with per-frame matrix updates only if a profiler blames them.
function FloatingDiyas({ glow }: { glow: boolean }) {
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
          {/* the additive halo is pure fill-rate — dropped on the potato tier */}
          {glow && <sprite material={flameGlowMat} position={[0, 0.12, 0]} scale={[0.85, 0.85, 1]} raycast={noRaycast} />}
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- assembly

export function Environment({ onSunMesh, oceanSegments = 110, sunLayers = 4, starCount = 1200, diyaGlow = true }: {
  onSunMesh?: (m: THREE.Mesh | null) => void;
  oceanSegments?: number;
  sunLayers?: number;
  starCount?: number;
  diyaGlow?: boolean;
}) {
  return (
    <group>
      <mesh material={skyMat} raycast={noRaycast}>
        <sphereGeometry args={[70, 32, 20]} />
      </mesh>
      <Stars radius={55} depth={25} count={starCount} factor={3} saturation={0} fade speed={0.4} />
      {diyaGlow && <DriftingClouds />}
      <Ocean onSunMesh={onSunMesh} segments={oceanSegments} sunLayers={sunLayers} moonGlow={diyaGlow} />
      <LankaIsland />
      <MainlandShore />
      <RamSetu />
      <FloatingDiyas glow={diyaGlow} />
    </group>
  );
}
