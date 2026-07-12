import * as THREE from 'three';

/** Shared materials — one instance each, reused by every mesh. */

// Ram's army: ivory sandstone with warm gold
export const ramMain = new THREE.MeshPhysicalMaterial({
  color: '#f0e3c6',
  roughness: 0.34,
  metalness: 0.06,
  clearcoat: 0.45,
  clearcoatRoughness: 0.5,
});
export const ramAccent = new THREE.MeshPhysicalMaterial({
  color: '#e3a83d',
  roughness: 0.24,
  metalness: 0.9,
  emissive: '#452c05',
  emissiveIntensity: 0.35,
});

// Lanka's army: dark obsidian-bronze with ember glow
export const lankaMain = new THREE.MeshPhysicalMaterial({
  color: '#3a3244',
  roughness: 0.42,
  metalness: 0.5,
  clearcoat: 0.35,
  clearcoatRoughness: 0.45,
});
export const lankaAccent = new THREE.MeshPhysicalMaterial({
  color: '#8a4a20',
  roughness: 0.3,
  metalness: 0.85,
  emissive: '#ff5a00',
  emissiveIntensity: 0.2,
});

// Board: warm temple sandstone
export const boardLight = new THREE.MeshStandardMaterial({ color: '#dcc39a', roughness: 0.75, metalness: 0.05 });
export const boardDark = new THREE.MeshStandardMaterial({ color: '#78462f', roughness: 0.75, metalness: 0.05 });
export const borderMat = new THREE.MeshStandardMaterial({ color: '#54301f', roughness: 0.7, metalness: 0.1 });
export const goldTrim = new THREE.MeshStandardMaterial({
  color: '#c9972f',
  roughness: 0.3,
  metalness: 0.9,
  emissive: '#3a2703',
  emissiveIntensity: 0.4,
});
export const pillarMat = new THREE.MeshStandardMaterial({ color: '#6b4028', roughness: 0.65, metalness: 0.1 });

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

// Environment
export const oceanMat = new THREE.MeshStandardMaterial({
  color: '#182a52',
  roughness: 0.18,
  metalness: 0.7,
  emissive: '#0a1228',
  emissiveIntensity: 0.5,
});
export const flameMat = new THREE.MeshStandardMaterial({
  color: '#ffb347',
  emissive: '#ff9020',
  emissiveIntensity: 2.6,
});
