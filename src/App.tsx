import { useGame } from './store';
import { Scene } from './scene/Scene';
import { Menu } from './ui/Menu';
import { HUD } from './ui/HUD';
import { PromotionPicker } from './ui/PromotionPicker';
import { GameOverModal } from './ui/GameOverModal';

export default function App() {
  const screen = useGame((s) => s.screen);

  if (screen === 'menu') return <Menu />;

  return (
    <div className="game-root">
      <Scene />
      <HUD />
      <PromotionPicker />
      <GameOverModal />
    </div>
  );
}
