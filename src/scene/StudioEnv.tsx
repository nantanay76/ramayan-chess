import { useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Image-based lighting from three's built-in RoomEnvironment (generated on
 * the GPU — nothing fetched, the game stays fully offline). Without this,
 * every metalness-0.9 gold accent has nothing to reflect and renders as flat
 * dark mustard; with it the statues' trim actually gleams. Intensity is kept
 * well below 1 in the main scene so the dusk key/fill lights still dominate.
 */
export function StudioEnv({ intensity = 0.45 }: { intensity?: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = envTex;
    return () => {
      if (scene.environment === envTex) scene.environment = null;
      envTex.dispose();
    };
  }, [gl, scene]);

  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);

  return null;
}
