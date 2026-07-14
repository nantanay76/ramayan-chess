import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { meshBounds } from '@react-three/drei';
import { useGame } from '../store';
import type { TrackedPiece } from '../game/pieceTracker';
import { squareToWorld } from './coords';
import { usePieceGeometry } from './pieceGeometry';
import { ramMain, ramAccent, lankaMain, lankaAccent } from './materials';
import { RavanaHeads } from './ravanaHeads';

function PieceMesh({ piece }: { piece: TrackedPiece }) {
  const isSelected = useGame((s) => s.selected === piece.square);
  const clickSquare = useGame((s) => s.clickSquare);
  const flipped = useGame((s) => s.flipped);
  const [hovered, setHovered] = useState(false);

  const army = piece.color === 'w' ? 'ram' : 'lanka';
  const geo = usePieceGeometry(piece.type, army);
  const [tx, tz] = squareToWorld(piece.square);
  const ty = isSelected ? 0.1 : 0;

  // statues face the viewer like temple idols (knights keep the classic
  // profile); the rig carries them through a flip, so counter-rotate in
  // group space to stay camera-facing — the lerp below makes them pirouette
  const ry =
    (piece.type === 'n' ? (piece.color === 'w' ? Math.PI / 2 : -Math.PI / 2) : 0) -
    (flipped ? Math.PI : 0);

  const ref = useRef<THREE.Group>(null);
  const rotRef = useRef<THREE.Group>(null);

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
    const rot = rotRef.current;
    if (rot) {
      const d = ry - rot.rotation.y;
      rot.rotation.y += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 5);
    }
  });

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
      <group ref={rotRef} rotation={[0, ry, 0]} scale={hovered && !isSelected ? 1.04 : 1}>
        {/* meshBounds: pointer picking against bounding spheres, not triangles */}
        <mesh
          geometry={geo.main}
          material={piece.color === 'w' ? ramMain : lankaMain}
          raycast={meshBounds}
          castShadow
          receiveShadow
        />
        {geo.accent && (
          <mesh
            geometry={geo.accent}
            material={piece.color === 'w' ? ramAccent : lankaAccent}
            raycast={meshBounds}
            castShadow
          />
        )}
        {piece.type === 'k' && piece.color === 'b' && <RavanaHeads main={geo.main} />}
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
