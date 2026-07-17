import * as THREE from 'three';

/** Shared materials — one instance each, reused by every mesh.
 *  envMapIntensity balances against StudioEnv's scene-wide IBL: metals drink
 *  deep from the env map (that's where the gleam lives), stone sips. */

// Ram's army: ivory sandstone with warm gold
export const ramMain = new THREE.MeshStandardMaterial({
  color: '#f0e3c6',
  roughness: 0.3,
  metalness: 0.06,
  envMapIntensity: 0.7,
});
export const ramAccent = new THREE.MeshStandardMaterial({
  color: '#e3a83d',
  roughness: 0.24,
  metalness: 0.9,
  emissive: '#452c05',
  emissiveIntensity: 0.35,
  envMapIntensity: 1.4,
});

// Lanka's army: dark obsidian-bronze with ember glow
export const lankaMain = new THREE.MeshStandardMaterial({
  color: '#3a3244',
  roughness: 0.38,
  metalness: 0.5,
  envMapIntensity: 0.9,
});
export const lankaAccent = new THREE.MeshStandardMaterial({
  color: '#8a4a20',
  roughness: 0.3,
  metalness: 0.85,
  emissive: '#ff5a00',
  emissiveIntensity: 0.2,
  envMapIntensity: 1.3,
});

// Board: warm temple sandstone
export const boardLight = new THREE.MeshStandardMaterial({ color: '#dcc39a', roughness: 0.75, metalness: 0.05, envMapIntensity: 0.4 });
export const boardDark = new THREE.MeshStandardMaterial({ color: '#78462f', roughness: 0.75, metalness: 0.05, envMapIntensity: 0.4 });
export const borderMat = new THREE.MeshStandardMaterial({ color: '#54301f', roughness: 0.7, metalness: 0.1, envMapIntensity: 0.4 });
export const goldTrim = new THREE.MeshStandardMaterial({
  color: '#c9972f',
  roughness: 0.3,
  metalness: 0.9,
  emissive: '#3a2703',
  emissiveIntensity: 0.4,
  envMapIntensity: 1.3,
});
export const pillarMat = new THREE.MeshStandardMaterial({ color: '#6b4028', roughness: 0.65, metalness: 0.1, envMapIntensity: 0.5 });

// Highlights
export const selectMat = new THREE.MeshBasicMaterial({
  color: '#ffd76a',
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
});
export const targetDotMat = new THREE.MeshBasicMaterial({
  color: '#ffe9a8',
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
});
export const captureRingMat = new THREE.MeshBasicMaterial({
  color: '#ff8f4a',
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  side: THREE.DoubleSide,
});
export const lastMoveMat = new THREE.MeshBasicMaterial({
  color: '#e8c05a',
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
});
export const checkMat = new THREE.MeshBasicMaterial({
  color: '#ff3b2f',
  transparent: true,
  opacity: 0.5,
  depthWrite: false,
});
/** Divine-counsel hint shimmer — celestial teal so it never reads as last-move gold. */
export const hintMat = new THREE.MeshBasicMaterial({
  color: '#5fe8c8',
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
});

// Environment
export const flameMat = new THREE.MeshStandardMaterial({
  color: '#ffb347',
  emissive: '#ff9020',
  emissiveIntensity: 2.6,
});

function radialGlowTexture(inner: string, mid: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, mid);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

/** Soft additive halo — replaces what Bloom used to do for flames. */
export const flameGlowMat = new THREE.SpriteMaterial({
  map: radialGlowTexture('rgba(255, 205, 130, 0.9)', 'rgba(255, 130, 45, 0.32)'),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});
export const cityGlowMat = new THREE.SpriteMaterial({
  map: radialGlowTexture('rgba(255, 160, 70, 0.5)', 'rgba(255, 100, 40, 0.16)'),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
});

function moonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 40, 64, 64, 52);
  grad.addColorStop(0, 'rgba(236, 241, 255, 0.98)');
  grad.addColorStop(0.88, 'rgba(224, 231, 252, 0.92)');
  grad.addColorStop(1, 'rgba(224, 231, 252, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.fill();
  // faint maria so it reads as a moon, not a lamp
  g.fillStyle = 'rgba(175, 186, 220, 0.4)';
  for (const [x, y, r] of [[48, 50, 8], [76, 66, 10], [57, 80, 5], [82, 42, 4]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

/** Pale rising moon over the mainland, opposite the dusk sun. */
export const moonMat = new THREE.SpriteMaterial({
  map: moonTexture(),
  transparent: true,
  depthWrite: false,
  fog: false,
});
export const moonGlowMat = new THREE.SpriteMaterial({
  map: radialGlowTexture('rgba(205, 218, 250, 0.4)', 'rgba(150, 172, 225, 0.13)'),
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  transparent: true,
  fog: false,
});

function cloudTexture(seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const g = canvas.getContext('2d')!;
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  // plum body: overlapping soft blobs along the strip
  for (let i = 0; i < 9; i++) {
    const x = 30 + rand() * 196;
    const y = 38 + rand() * 26;
    const r = 18 + rand() * 26;
    const grad = g.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, 'rgba(74, 48, 98, 0.5)');
    grad.addColorStop(0.7, 'rgba(58, 35, 80, 0.26)');
    grad.addColorStop(1, 'rgba(58, 35, 80, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 96);
  }
  // warm dusk light catching the underside
  for (let i = 0; i < 5; i++) {
    const x = 40 + rand() * 176;
    const y = 60 + rand() * 16;
    const r = 12 + rand() * 16;
    const grad = g.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, 'rgba(216, 122, 74, 0.3)');
    grad.addColorStop(1, 'rgba(216, 122, 74, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 96);
  }
  return new THREE.CanvasTexture(canvas);
}

/** Three cloud variants shared across the horizon sprites. */
export const cloudMats = [21, 47, 83].map(
  (seed) =>
    new THREE.SpriteMaterial({
      map: cloudTexture(seed),
      transparent: true,
      depthWrite: false,
      fog: false,
    }),
);

// Distant land — cheapest lit materials, softened by fog
export const sandMat = new THREE.MeshLambertMaterial({ color: '#7d5f45' });
export const cliffMat = new THREE.MeshLambertMaterial({ color: '#3a2a4a', flatShading: true });
export const rockMat = new THREE.MeshLambertMaterial({ color: '#4a3a4e', flatShading: true });
export const setuStoneMat = new THREE.MeshLambertMaterial({ color: '#6e5a49', flatShading: true });
export const palmTrunkMat = new THREE.MeshLambertMaterial({ color: '#3d2b20' });
export const palmLeafMat = new THREE.MeshLambertMaterial({ color: '#1f3d2a', side: THREE.DoubleSide });

function windowsTexture(seed: number, density: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 64, 128);
  let s = seed;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  for (let y = 8; y < 120; y += 10) {
    for (let x = 6; x < 58; x += 9) {
      if (rand() < density) {
        g.fillStyle = rand() < 0.7 ? '#ffbe6b' : '#ffd9a0';
        g.fillRect(x, y, 3, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/** Lanka's palace towers: dark stone with lit windows glowing across the sea.
 *  Several variants so the skyline doesn't read as one texture tiled everywhere. */
export const towerMats = [
  { seed: 21, density: 0.38, color: '#231830' },
  { seed: 53, density: 0.3, color: '#28162a' },
  { seed: 89, density: 0.46, color: '#1e1a33' },
  { seed: 127, density: 0.34, color: '#2b1522' },
].map(
  ({ seed, density, color }) =>
    new THREE.MeshLambertMaterial({
      color,
      emissive: '#ffb257',
      emissiveIntensity: 1.15,
      emissiveMap: windowsTexture(seed, density),
    }),
);
