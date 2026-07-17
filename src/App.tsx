import { lazy, Suspense } from 'react';
import { useGame } from './store';
import { Menu } from './ui/Menu';
import { HUD } from './ui/HUD';
import { PromotionPicker } from './ui/PromotionPicker';
import { GameOverModal } from './ui/GameOverModal';

// The whole three.js/drei/postprocessing stack lives in this lazy chunk — the
// menu paints without downloading or parsing any of it.
const GameCanvas = lazy(() => import('./scene/GameCanvas'));

/** Static twin of the LoadingVeil markup, shown while the 3D chunk itself
 *  downloads; the real veil (inside the chunk) takes over seamlessly. */
function VeilFallback() {
  return (
    <div className="loading-veil">
      <div className="loading-om">ॐ</div>
      <div className="loading-bar">
        <div className="loading-fill" style={{ width: '6%' }} />
      </div>
      <div className="loading-caption">The armies assemble…</div>
    </div>
  );
}

export default function App() {
  const screen = useGame((s) => s.screen);

  if (screen === 'menu') return <Menu />;

  return (
    <div className="game-root">
      <Suspense fallback={<VeilFallback />}>
        <GameCanvas />
      </Suspense>
      <HUD />
      <PromotionPicker />
      <GameOverModal />
    </div>
  );
}
