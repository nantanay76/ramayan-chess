import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGame } from '../store';
import type { TrackedPiece } from '../game/pieceTracker';
import { squareToWorld } from './coords';
import { pieceGeometry } from './pieceGeometry';
import { ramMain, ramAccent, lankaMain, lankaAccent } from './materials';

function PieceMesh({ piece }: { piece: TrackedPiece }) {
  const flipped = useGame((s) => s.flipped);
  const isSelected = useGame((s) => s.selected === piece.square);
  const clickSquare = useGame((s) => s.clickSquare);
  const [hovered, setHovered] = useState(false);

  const army = piece.color === 'w' ? 'ram' : 'lanka';
  const geo = pieceGeometry(piece.type, army);
  const [tx, tz] = squareToWorld(piece.square, flipped);
  const ty = isSelected ? 0.1 : 0;

  const ref = useRef<THREE.Group>(null);

  useFrame((_, rawDt) => {
    const g = ref.current;
    if (!g) return;
    const dt = Math.min(rawDt, 0.05);
    const pos = g.position;
    const dx = tx - pos.x;
    const dz = tz - pos.z;
    const dist = Math.hypot(dx, dz);
    const k = Math.min(1, dt * 9);
    pos.x += dx * k;
    pos.z += dz * k;
    // gentle arc while travelling
    const hop = Math.min(0.45, dist * 0.5);
    pos.y += (ty + hop - pos.y) * Math.min(1, dt * 11);
  });

  // pieces face their opponent regardless of camera orientation; knights show
  // their carved profile to the camera so the horse silhouette stays readable
  const facesNegZ = (piece.color === 'w') !== flipped;
  const ry =
    piece.type === 'n'
      ? piece.color === 'w'
        ? 0
        : Math.PI
      : facesNegZ
        ? Math.PI / 2
        : -Math.PI / 2;

  return (
    <group
      ref={ref}
      position={[tx, 0, tz]}
      onClick={(e) => {
        e.stopPropagation();
        clickSquare(piece.square);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <group rotation={[0, ry, 0]} scale={hovered && !isSelected ? 1.04 : 1}>
        <mesh geometry={geo.main} material={piece.color === 'w' ? ramMain : lankaMain} castShadow receiveShadow />
        <mesh geometry={geo.accent} material={piece.color === 'w' ? ramAccent : lankaAccent} castShadow />
      </group>
    </group>
  );
}

export function Pieces() {
  const pieces = useGame((s) => s.pieces);
  return (
    <group>
      {pieces.map((p) => (
        <PieceMesh key={p.id} piece={p} />
      ))}
    </group>
  );
}
