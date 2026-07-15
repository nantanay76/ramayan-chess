import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

/**
 * Themed cover over the scene while the piece models load, so statues don't
 * pop into an already-live battlefield. Starts pre-dismissed when assets are
 * already in memory (returning from the menu mid-session) — the veil is for
 * real loads, not a mandatory splash.
 */
export function LoadingVeil() {
  const active = useProgress((s) => s.active);
  const progress = useProgress((s) => s.progress);
  const [gone, setGone] = useState(() => {
    const s = useProgress.getState();
    return !s.active && s.progress >= 100;
  });

  const done = !active && progress >= 100;

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
