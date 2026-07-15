import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useGame } from '../store';

/**
 * Themed cover over the scene while the piece models load, so statues don't
 * pop into an already-live battlefield.
 *
 * Dismissal waits on BOTH the GLB load finishing AND the scene warming up
 * (sceneReady, set by StartupFade once shaders are compiled and exposure has
 * faded in) — so the cold-start hitch stays hidden behind the veil and the
 * reveal reads as a curtain rising, not a bright flash. The veil always starts
 * visible: leaving to the menu unmounts the Canvas, so every game start spins up
 * a fresh WebGL context that has to recompile shaders — a "cached assets" shortcut
 * would just expose that recompile as the very flash we're removing.
 */
export function LoadingVeil() {
  const active = useProgress((s) => s.active);
  const progress = useProgress((s) => s.progress);
  const sceneReady = useGame((s) => s.sceneReady);
  const [gone, setGone] = useState(false);

  const done = !active && progress >= 100 && sceneReady;

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setGone(true), 700); // matches the CSS fade
    return () => clearTimeout(id);
  }, [done]);

  if (gone) return null;

  return (
    <div className={`loading-veil ${done ? 'done' : ''}`} aria-hidden={done}>
      <div className="loading-om">ॐ</div>
      <div className="loading-bar">
        <div className="loading-fill" style={{ width: `${Math.max(6, progress)}%` }} />
      </div>
      <div className="loading-caption">The armies assemble…</div>
    </div>
  );
}
