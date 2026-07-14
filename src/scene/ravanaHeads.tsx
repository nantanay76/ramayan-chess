import { useMemo } from 'react';
import * as THREE from 'three';
import { meshBounds } from '@react-three/drei';
import { lankaMain, lankaAccent } from './materials';

/**
 * Ravana's iconic ten heads. The king-lanka statue is sculpted with one head
 * like every other king, so nine extra crowned heads are fanned around it
 * here at render time — procedural, so it doesn't depend on re-exporting the
 * Blender model (this machine has no Blender install). Note: scripts/blender
 * /gen_pieces.py's build_king() already sculpts a fanned ten-heads Ravana in
 * source — the shipped public/models/pieces.glb just predates that and was
 * never re-exported. If it's ever regenerated with Blender, remove this
 * runtime supplement so heads don't double up. The fan spans left to right
 * rather than front-to-back, since that reads correctly regardless of which
 * local axis the sculpted statue treats as "forward."
 */
export function RavanaHeads({ main }: { main: THREE.BufferGeometry }) {
  const heads = useMemo(() => {
    main.computeBoundingBox();
    const bb = main.boundingBox ?? new THREE.Box3(new THREE.Vector3(-0.3, 0, -0.3), new THREE.Vector3(0.3, 1.2, 0.3));
    const cx = (bb.min.x + bb.max.x) / 2;
    const cz = (bb.min.z + bb.max.z) / 2;
    const totalH = bb.max.y - bb.min.y;
    const baseY = bb.max.y - totalH * 0.11;
    const headR = totalH * 0.072;
    const fanRadius = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.34;
    const N = 9;
    return Array.from({ length: N }, (_, i) => {
      const t = i / (N - 1) - 0.5; // -0.5..0.5, center excluded (the sculpted head is the tenth)
      const angle = t * Math.PI * 1.15; // fan spanning ~207 degrees, left to right
      const edge = Math.abs(t) * 2; // 0 at center, 1 at the outer edges
      return {
        pos: [
          cx + Math.sin(angle) * fanRadius,
          baseY + edge * headR * 1.6,
          cz + (Math.cos(angle) - 1) * fanRadius * 0.35,
        ] as [number, number, number],
        scale: headR * (1 - edge * 0.32),
        rotY: angle * 0.6,
      };
    });
  }, [main]);

  return (
    <group>
      {heads.map((h, i) => (
        <mesh
          key={i}
          material={lankaMain}
          position={h.pos}
          rotation={[0, h.rotY, 0]}
          raycast={meshBounds}
          castShadow
        >
          <sphereGeometry args={[h.scale, 10, 8]} />
          <mesh material={lankaAccent} position={[0, h.scale * 1.15, 0]} raycast={meshBounds} castShadow>
            <coneGeometry args={[h.scale * 0.55, h.scale * 0.95, 6]} />
          </mesh>
        </mesh>
      ))}
    </group>
  );
}
