import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Square } from 'chess.js';
import { useGame } from '../store';
import { SQUARES, isDarkSquare, squareToWorld } from './coords';
import {
  boardLight,
  boardDark,
  borderMat,
  goldTrim,
  pillarMat,
  flameMat,
  flameGlowMat,
  selectMat,
  targetDotMat,
  captureRingMat,
  lastMoveMat,
  checkMat,
  hintMat,
} from './materials';

const squareGeo = new THREE.BoxGeometry(0.995, 0.12, 0.995);
const overlayGeo = new THREE.PlaneGeometry(0.97, 0.97);
const dotGeo = new THREE.CircleGeometry(0.13, 24);
const ringGeo = new THREE.RingGeometry(0.3, 0.42, 36);

function labelTexture(text: string, px = 64, font = '600 72px Georgia, "Nirmala UI", serif'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.font = font.replace('72px', `${px}px`);
  g.fillStyle = '#e8c05a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function inscriptionTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.font = '600 74px "Nirmala UI", "Mangal", serif';
  g.fillStyle = '#e8c05a';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 512, 70);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  return tex;
}

function FlatLabel({ text, x, z, size = 0.42 }: { text: string; x: number; z: number; size?: number }) {
  const tex = useMemo(() => labelTexture(text), [text]);
  return (
    <mesh position={[x, 0.075, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} transparent opacity={0.95} depthWrite={false} />
    </mesh>
  );
}

const LIGHT_SQUARES = SQUARES.filter((sq) => !isDarkSquare(sq));
const DARK_SQUARES = SQUARES.filter(isDarkSquare);

/** All 32 squares of one colour in a single InstancedMesh — 2 draw calls for
 *  the whole board (and 2 in the shadow pass) instead of 64+64. Squares are
 *  placed statically; flips rotate the whole rig, and clicks resolve through
 *  the raycast hit's instanceId. */
function SquareInstances({ squares, material }: { squares: Square[]; material: THREE.Material }) {
  const clickSquare = useGame((s) => s.clickSquare);
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    squares.forEach((sq, i) => {
      const [x, z] = squareToWorld(sq);
      m.makeTranslation(x, -0.06, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [squares]);
  return (
    <instancedMesh
      ref={ref}
      args={[squareGeo, material, squares.length]}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId != null) clickSquare(squares[e.instanceId]);
      }}
    />
  );
}

function Squares() {
  return (
    <group>
      <SquareInstances squares={LIGHT_SQUARES} material={boardLight} />
      <SquareInstances squares={DARK_SQUARES} material={boardDark} />
    </group>
  );
}

function CheckOverlay({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    checkMat.opacity = 0.35 + Math.sin(clock.elapsedTime * 5) * 0.18;
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.4;
  });
  return (
    <mesh ref={ref} geometry={overlayGeo} material={checkMat} position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]} />
  );
}

/** Divine-counsel shimmer on the suggested from/to squares. */
function HintOverlay() {
  const hint = useGame((s) => s.hint);
  useFrame(({ clock }) => {
    hintMat.opacity = 0.3 + Math.sin(clock.elapsedTime * 4) * 0.16;
  });
  if (!hint) return null;
  return (
    <>
      {[hint.from, hint.to].map((sq) => {
        const [x, z] = squareToWorld(sq);
        return (
          <mesh
            key={`h-${sq}`}
            geometry={overlayGeo}
            material={hintMat}
            position={[x, 0.0055, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        );
      })}
    </>
  );
}

function Overlays() {
  const selected = useGame((s) => s.selected);
  const targets = useGame((s) => s.targets);
  const lastMove = useGame((s) => s.lastMove);
  const checkSquare = useGame((s) => s.checkSquare);
  const clickSquare = useGame((s) => s.clickSquare);
  const showMoveDots = useGame((s) => s.showMoveDots);

  const targetSquares = useMemo(() => {
    const seen = new Map<Square, boolean>();
    for (const m of targets) {
      const isCapture = m.flags.includes('c') || m.flags.includes('e');
      if (!seen.has(m.to) || isCapture) seen.set(m.to, isCapture);
    }
    return [...seen.entries()];
  }, [targets]);

  const flat: [number, number, number] = [-Math.PI / 2, 0, 0];

  return (
    <group>
      {lastMove &&
        [lastMove.from, lastMove.to].map((sq) => {
          const [x, z] = squareToWorld(sq);
          return <mesh key={`lm-${sq}`} geometry={overlayGeo} material={lastMoveMat} position={[x, 0.004, z]} rotation={flat} />;
        })}
      {selected &&
        (() => {
          const [x, z] = squareToWorld(selected);
          return <mesh geometry={overlayGeo} material={selectMat} position={[x, 0.006, z]} rotation={flat} />;
        })()}
      <HintOverlay />
      {showMoveDots && targetSquares.map(([sq, isCapture]) => {
        const [x, z] = squareToWorld(sq);
        return (
          <mesh
            key={`t-${sq}`}
            geometry={isCapture ? ringGeo : dotGeo}
            material={isCapture ? captureRingMat : targetDotMat}
            position={[x, 0.007, z]}
            rotation={flat}
            onClick={(e) => {
              e.stopPropagation();
              clickSquare(sq);
            }}
          />
        );
      })}
      {checkSquare &&
        (() => {
          const [x, z] = squareToWorld(checkSquare);
          return <CheckOverlay x={x} z={z} />;
        })()}
    </group>
  );
}

const flameGeo = new THREE.SphereGeometry(0.05, 10, 10);

function DiyaFlame({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const seed = useMemo(() => Math.random() * 10, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 7 + seed;
    const s = 1 + Math.sin(t) * 0.14 + Math.sin(t * 2.7) * 0.08;
    ref.current.scale.set(s * 0.85, s * 1.25, s * 0.85);
  });
  return (
    <group position={position}>
      <mesh ref={ref} geometry={flameGeo} material={flameMat} />
      <sprite material={flameGlowMat} position={[0, 0.03, 0]} scale={[0.8, 0.8, 1]} />
    </group>
  );
}

function Frame() {
  const inscriptionFront = useMemo(() => inscriptionTexture('॥ जय श्री राम ॥'), []);
  const inscriptionBack = useMemo(() => inscriptionTexture('॥ रामायण शतरंज ॥'), []);
  return (
    <group>
      {/* foundation slab */}
      <mesh material={borderMat} position={[0, -0.33, 0]} receiveShadow>
        <boxGeometry args={[9.9, 0.42, 9.9]} />
      </mesh>
      {/* border slabs */}
      {[
        { pos: [0, -0.045, 4.45] as const, size: [9.9, 0.21, 0.9] as const },
        { pos: [0, -0.045, -4.45] as const, size: [9.9, 0.21, 0.9] as const },
        { pos: [4.45, -0.045, 0] as const, size: [0.9, 0.21, 8] as const },
        { pos: [-4.45, -0.045, 0] as const, size: [0.9, 0.21, 8] as const },
      ].map((slab, i) => (
        <mesh key={i} material={borderMat} position={slab.pos as unknown as [number, number, number]} receiveShadow>
          <boxGeometry args={slab.size as unknown as [number, number, number]} />
        </mesh>
      ))}
      {/* gold trim strips hugging the squares */}
      {[
        { pos: [0, 0.055, 4.03] as const, size: [8.12, 0.035, 0.06] as const },
        { pos: [0, 0.055, -4.03] as const, size: [8.12, 0.035, 0.06] as const },
        { pos: [4.03, 0.055, 0] as const, size: [0.06, 0.035, 8.12] as const },
        { pos: [-4.03, 0.055, 0] as const, size: [0.06, 0.035, 8.12] as const },
      ].map((strip, i) => (
        <mesh key={i} material={goldTrim} position={strip.pos as unknown as [number, number, number]}>
          <boxGeometry args={strip.size as unknown as [number, number, number]} />
        </mesh>
      ))}
      {/* inscriptions on the outer faces */}
      <mesh position={[0, -0.02, 4.905]}>
        <planeGeometry args={[4.6, 0.58]} />
        <meshBasicMaterial map={inscriptionFront} transparent depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.02, -4.905]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[4.6, 0.58]} />
        <meshBasicMaterial map={inscriptionBack} transparent depthWrite={false} />
      </mesh>
      {/* corner pillars with diyas */}
      {[
        [4.45, 4.45],
        [-4.45, 4.45],
        [4.45, -4.45],
        [-4.45, -4.45],
      ].map(([px, pz], i) => (
        <group key={i} position={[px, 0, pz]}>
          <mesh material={pillarMat} position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.24, 0.3, 0.42, 16]} />
          </mesh>
          <mesh material={goldTrim} position={[0, 0.33, 0]}>
            <cylinderGeometry args={[0.16, 0.2, 0.07, 16]} />
          </mesh>
          <DiyaFlame position={[0, 0.44, 0]} />
        </group>
      ))}
    </group>
  );
}

/**
 * Coordinate labels live outside the rotating board rig so they always hug
 * the near/left edges of the screen; flipping re-maps which file/rank each
 * label names instead of physically travelling with the board.
 */
export function EdgeLabels() {
  const flipped = useGame((s) => s.flipped);
  const showCoords = useGame((s) => s.showCoords);
  if (!showCoords) return null;
  const labels: Array<{ key: string; text: string; x: number; z: number }> = [];
  for (let f = 0; f < 8; f++) {
    const letter = String.fromCharCode(97 + f);
    labels.push({ key: `f-${letter}`, text: letter, x: flipped ? 3.5 - f : f - 3.5, z: 4.42 });
  }
  for (let r = 0; r < 8; r++) {
    labels.push({ key: `r-${r + 1}`, text: String(r + 1), x: -4.42, z: flipped ? r - 3.5 : 3.5 - r });
  }
  return (
    <group>
      {labels.map((l) => (
        <FlatLabel key={`${l.key}-${flipped}`} text={l.text} x={l.x} z={l.z} size={0.34} />
      ))}
    </group>
  );
}

export function Board() {
  return (
    <group>
      <Squares />
      <Overlays />
      <Frame />
    </group>
  );
}
