import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store';
import { squareToWorld } from './coords';

/**
 * Battle sparks: one preallocated Points pool — a gold burst where a piece
 * falls, a staggered volley over the mated king. Mounted inside BoardRig so
 * squareToWorld positions stay honest when the board flips. Costs nothing
 * while idle (points.visible = false, no per-frame writes).
 */
const COUNT = 240;
const LIFE = 0.9;
const GOLD = new THREE.Color('#f0c46a');
const EMBER = new THREE.Color('#ff9a5a');

interface Pending {
  x: number;
  z: number;
  delay: number;
  n: number;
  ember: boolean;
}

export function BattleFx() {
  const pointsRef = useRef<THREE.Points>(null);

  const pool = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    // park dead particles far below the ocean so they never render
    for (let i = 0; i < COUNT; i++) positions[i * 3 + 1] = -999;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    return {
      geometry,
      material,
      vel: new Float32Array(COUNT * 3),
      life: new Float32Array(COUNT),
      base: new Float32Array(COUNT * 3),
      alive: 0,
      pending: [] as Pending[],
    };
  }, []);

  useEffect(() => {
    return () => {
      pool.geometry.dispose();
      pool.material.dispose();
    };
  }, [pool]);

  const spawn = useCallback(function spawn(x: number, z: number, n: number, ember: boolean, lifeScale = 1) {
    const pos = pool.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    let spawned = 0;
    for (let i = 0; i < COUNT && spawned < n; i++) {
      if (pool.life[i] > 0) continue;
      pool.life[i] = LIFE * (0.6 + Math.random() * 0.4) * lifeScale;
      arr[i * 3] = x + (Math.random() - 0.5) * 0.3;
      arr[i * 3 + 1] = 0.35 + Math.random() * 0.3;
      arr[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3;
      const angle = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 1.6;
      pool.vel[i * 3] = Math.cos(angle) * r;
      pool.vel[i * 3 + 1] = 2.2 + Math.random() * 2.6;
      pool.vel[i * 3 + 2] = Math.sin(angle) * r;
      const c = ember ? EMBER : GOLD;
      pool.base[i * 3] = c.r;
      pool.base[i * 3 + 1] = c.g;
      pool.base[i * 3 + 2] = c.b;
      spawned++;
    }
    pool.alive += spawned;
    pos.needsUpdate = true;
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, number>;
      w.__fxSpawns = (w.__fxSpawns ?? 0) + spawned;
    }
  }, [pool]);

  if (import.meta.env.DEV) {
    // deterministic hook for headless verification (frame pacing there makes
    // real capture timing unreliable to screenshot)
    (window as unknown as Record<string, unknown>).__fxBurst = (n = 120) => spawn(0, 0, n, false, 8);
  }

  // Trigger off store changes via a processed-length ref — StrictMode's
  // double-invoked effects then can't double-burst the same move.
  const seenPly = useRef(-1);
  const seenOverSeq = useRef(false);
  const history = useGame((s) => s.history);
  const lastMove = useGame((s) => s.lastMove);
  const gameOver = useGame((s) => s.gameOver);
  const checkSquare = useGame((s) => s.checkSquare);

  useEffect(() => {
    const len = history.length;
    if (len <= seenPly.current || len === 0) {
      // new game or undo — just resync, never burst
      seenPly.current = len;
      seenOverSeq.current = false;
      return;
    }
    seenPly.current = len;
    const last = history[len - 1];
    if (lastMove && (last.flags.includes('c') || last.flags.includes('e'))) {
      const [x, z] = squareToWorld(lastMove.to);
      // spawn directly (not via pending) so the burst is on the very next frame
      spawn(x, z, 50, last.color === 'b');
    }
  }, [history, lastMove, spawn]);

  useEffect(() => {
    if (!gameOver || seenOverSeq.current) return;
    seenOverSeq.current = true;
    if (gameOver.reason !== 'checkmate' || !checkSquare) return;
    const [x, z] = squareToWorld(checkSquare);
    // a staggered three-burst volley over the fallen king
    pool.pending.push(
      { x, z, delay: 0.15, n: 60, ember: false },
      { x, z, delay: 0.55, n: 50, ember: true },
      { x, z, delay: 0.95, n: 60, ember: false },
    );
  }, [gameOver, checkSquare, pool]);

  useFrame((_, rawDt) => {
    // clamp: after a background-tab pause (or sparse headless frames) rawDt is
    // seconds — an unclamped step would age every spark to death in one frame
    const dt = Math.min(rawDt, 0.05);
    const points = pointsRef.current;
    if (!points) return;
    if (pool.pending.length > 0) {
      const still: Pending[] = [];
      for (const p of pool.pending) {
        p.delay -= dt;
        if (p.delay <= 0) spawn(p.x, p.z, p.n, p.ember);
        else still.push(p);
      }
      pool.pending = still;
    }
    if (pool.alive === 0) {
      points.visible = false;
      return;
    }
    points.visible = true;
    const pos = pool.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = pool.geometry.getAttribute('color') as THREE.BufferAttribute;
    const parr = pos.array as Float32Array;
    const carr = col.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      if (pool.life[i] <= 0) continue;
      pool.life[i] -= dt;
      if (pool.life[i] <= 0) {
        pool.alive--;
        parr[i * 3 + 1] = -999;
        carr[i * 3] = carr[i * 3 + 1] = carr[i * 3 + 2] = 0;
        continue;
      }
      pool.vel[i * 3 + 1] -= 6.5 * dt; // gravity
      parr[i * 3] += pool.vel[i * 3] * dt;
      parr[i * 3 + 1] += pool.vel[i * 3 + 1] * dt;
      parr[i * 3 + 2] += pool.vel[i * 3 + 2] * dt;
      // additive blending: fading to black fades the spark out
      const f = Math.max(0, pool.life[i] / LIFE) ** 1.4;
      carr[i * 3] = pool.base[i * 3] * f;
      carr[i * 3 + 1] = pool.base[i * 3 + 1] * f;
      carr[i * 3 + 2] = pool.base[i * 3 + 2] * f;
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  });

  return <points ref={pointsRef} geometry={pool.geometry} material={pool.material} frustumCulled={false} />;
}
