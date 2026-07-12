import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { oceanMat, flameMat } from './materials';

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    topColor: { value: new THREE.Color('#161029') },
    midColor: { value: new THREE.Color('#5d3263') },
    botColor: { value: new THREE.Color('#ef8348') },
  },
  vertexShader: /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 topColor;
    uniform vec3 midColor;
    uniform vec3 botColor;
    varying vec3 vPos;
    void main() {
      float h = normalize(vPos).y;
      vec3 c = mix(botColor, midColor, smoothstep(-0.02, 0.22, h));
      c = mix(c, topColor, smoothstep(0.2, 0.65, h));
      gl_FragColor = vec4(c, 1.0);
    }
  `,
});

function sunTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const g = canvas.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 214, 140, 0.95)');
  grad.addColorStop(0.25, 'rgba(255, 160, 80, 0.55)');
  grad.addColorStop(0.6, 'rgba(230, 100, 60, 0.18)');
  grad.addColorStop(1, 'rgba(230, 100, 60, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

/** Fixed pseudo-random ring of floating diyas out on the water. */
const DIYAS: Array<[number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.5;
    const r = 10 + rand() * 9;
    out.push([Math.cos(a) * r, rand() * Math.PI * 2, Math.sin(a) * r]);
  }
  return out;
})();

function FloatingDiyas() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    g.children.forEach((child, i) => {
      child.position.y = -1.32 + Math.sin(clock.elapsedTime * 0.9 + DIYAS[i][1]) * 0.06;
    });
  });
  return (
    <group ref={ref}>
      {DIYAS.map(([x, , z], i) => (
        <group key={i} position={[x, -1.32, z]}>
          <mesh material={flameMat}>
            <sphereGeometry args={[0.09, 8, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Environment() {
  const sunTex = useMemo(sunTexture, []);
  return (
    <group>
      <mesh material={skyMat}>
        <sphereGeometry args={[70, 32, 20]} />
      </mesh>
      <Stars radius={55} depth={25} count={2000} factor={3} saturation={0} fade speed={0.4} />
      {/* dusk sun low on the horizon */}
      <mesh position={[-10, 6, -48]}>
        <planeGeometry args={[30, 30]} />
        <meshBasicMaterial map={sunTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      {/* the ocean of the Ram Setu */}
      <mesh material={oceanMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]}>
        <circleGeometry args={[80, 48]} />
      </mesh>
      <FloatingDiyas />
    </group>
  );
}
