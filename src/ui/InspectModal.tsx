import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { Group } from 'three';
import type { Color, PieceSymbol } from 'chess.js';
import { CHARACTERS } from '../game/characters';
import { usePieceGeometry, type Army } from '../scene/pieceGeometry';
import { ramMain, ramAccent, lankaMain, lankaAccent } from '../scene/materials';
import { RavanaHeads } from '../scene/ravanaHeads';

const TURNTABLE_SPEED = 0.5; // rad/s — slow, so details are easy to read

function InspectPiece({ type, color }: { type: PieceSymbol; color: Color }) {
  const army: Army = color === 'w' ? 'ram' : 'lanka';
  const geo = usePieceGeometry(type, army);
  const ref = useRef<Group>(null);
  // pieces range 0.66 (pawn) to 1.34 (king) tall — recenter each on its own
  // midpoint so every piece sits the same in frame regardless of height.
  const offsetY = useMemo(() => {
    geo.main.computeBoundingBox();
    const bb = geo.main.boundingBox;
    return bb ? -(bb.min.y + bb.max.y) / 2 : 0;
  }, [geo.main]);

  // turntable spin — driven here (not OrbitControls.autoRotate) so it's
  // guaranteed to run regardless of camera interaction.
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * TURNTABLE_SPEED;
  });

  return (
    <group ref={ref} position={[0, offsetY, 0]}>
      <mesh geometry={geo.main} material={color === 'w' ? ramMain : lankaMain} castShadow receiveShadow />
      {geo.accent && (
        <mesh geometry={geo.accent} material={color === 'w' ? ramAccent : lankaAccent} castShadow />
      )}
      {type === 'k' && color === 'b' && <RavanaHeads main={geo.main} />}
    </group>
  );
}

export function InspectModal({
  type,
  color,
  onClose,
}: {
  type: PieceSymbol;
  color: Color;
  onClose: () => void;
}) {
  const c = CHARACTERS[color][type];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="inspect-modal" onClick={(e) => e.stopPropagation()}>
        <button className="inspect-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="inspect-viewport">
          <Canvas camera={{ position: [0, 0.5, 2.5], fov: 34 }} shadows>
            <ambientLight intensity={0.55} color="#fff2df" />
            <directionalLight position={[2, 3, 2]} intensity={1.7} color="#ffe9c8" castShadow />
            <directionalLight position={[-2.5, 1.3, -1.5]} intensity={0.55} color="#8fb4ff" />
            <directionalLight position={[0, 1, -2.6]} intensity={0.6} color="#ffb066" />
            <mesh position={[0, -0.66, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <circleGeometry args={[0.95, 32]} />
              <meshStandardMaterial color="#2a1a12" roughness={0.65} />
            </mesh>
            <Suspense fallback={null}>
              <InspectPiece type={type} color={color} />
            </Suspense>
            <OrbitControls enablePan={false} minDistance={1.3} maxDistance={4} target={[0, 0, 0]} />
          </Canvas>
        </div>
        <div className="inspect-info">
          <div className="modal-title-hi">{c.hi}</div>
          <div className="modal-title-en">
            {c.en} · {c.piece}
          </div>
          <p className="inspect-lore">{c.lore}</p>
        </div>
      </div>
    </div>
  );
}
