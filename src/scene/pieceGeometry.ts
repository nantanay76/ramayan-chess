import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PieceSymbol } from 'chess.js';

export type Army = 'ram' | 'lanka';

export interface PieceGeo {
  main: THREE.BufferGeometry;
  accent: THREE.BufferGeometry | null;
}

/**
 * Blender-sculpted statues (scripts/blender/gen_pieces.py) shipped as one
 * GLB. Each piece is a node named "<type>-<army>" whose primitives carry
 * either a main_* or accent_* material — the game renders them with its own
 * shared materials, so the GLB stores geometry only.
 */
const MODEL_URL = `${import.meta.env.BASE_URL}models/pieces.glb`;

const cache = new Map<string, PieceGeo>();

function extract(scene: THREE.Group, key: string): PieceGeo {
  const hit = cache.get(key);
  if (hit) return hit;

  scene.updateMatrixWorld(true);
  const root = scene.getObjectByName(key);
  if (!root) throw new Error(`pieces.glb is missing node "${key}"`);

  const mains: THREE.BufferGeometry[] = [];
  const accents: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    const matName = (mesh.material as THREE.Material)?.name ?? '';
    (matName.startsWith('accent') ? accents : mains).push(geo);
  });

  const joinAll = (list: THREE.BufferGeometry[]) =>
    list.length === 0 ? null : list.length === 1 ? list[0] : mergeGeometries(list, false);

  const main = joinAll(mains);
  if (!main) throw new Error(`pieces.glb node "${key}" has no main geometry`);
  const geo: PieceGeo = { main, accent: joinAll(accents) };
  cache.set(key, geo);
  return geo;
}

/** Suspends until the model file is loaded (render inside <Suspense>). */
export function usePieceGeometry(type: PieceSymbol, army: Army): PieceGeo {
  const { scene } = useGLTF(MODEL_URL);
  return extract(scene, `${type}-${army}`);
}

useGLTF.preload(MODEL_URL);
