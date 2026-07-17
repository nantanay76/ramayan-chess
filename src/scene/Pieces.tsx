import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { meshBounds } from '@react-three/drei';
import type { Color, PieceSymbol } from 'chess.js';
import { useGame } from '../store';
import type { TrackedPiece } from '../game/pieceTracker';
import { PIECE_GLYPH } from '../game/characters';
import { squareToWorld } from './coords';
import { usePieceGeometry } from './pieceGeometry';
import { ramMain, ramAccent, lankaMain, lankaAccent } from './materials';

/** Top-down identification badges: from straight above the statues all read as
 *  discs, so each piece wears a camera-facing chess-glyph token — dark pill,
 *  army-colored ring + symbol. One SpriteMaterial per color+type, cached. */
const badgeCache = new Map<string, THREE.SpriteMaterial>();
const noRaycast = () => null;

function badgeMat(color: Color, type: PieceSymbol): THREE.SpriteMaterial {
  const key = color + type;
  let mat = badgeCache.get(key);
  if (mat) return mat;
  const armyColor = color === 'w' ? '#f0c46a' : '#b7a3d9';
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const g = canvas.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 56, 0, Math.PI * 2);
  g.fillStyle = 'rgba(19, 9, 18, 0.92)';
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = armyColor;
  g.stroke();
  // the FILLED glyph set for both armies (the outline ♔ set reads too thin
  // at badge size) — the army is carried by color, like a 2D diagram set
  g.font = '84px "Segoe UI Symbol", serif';
  g.fillStyle = armyColor;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(PIECE_GLYPH.b[type], 64, 68);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  // depthTest off: it's a UI marker — never clipped by a tall statue, so it
  // can sit low enough to stay visually glued to its square from above
  mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
  badgeCache.set(key, mat);
  return mat;
}

function PieceMesh({ piece }: { piece: TrackedPiece }) {
  const isSelected = useGame((s) => s.selected === piece.square);
  const clickSquare = useGame((s) => s.clickSquare);
  const flipped = useGame((s) => s.flipped);
  const topDown = useGame((s) => s.topDownView);
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
      </group>
      {topDown && (
        <sprite
          material={badgeMat(piece.color, piece.type)}
          position={[0, 1.3, 0]}
          scale={[0.5, 0.5, 1]}
          raycast={noRaycast}
        />
      )}
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
