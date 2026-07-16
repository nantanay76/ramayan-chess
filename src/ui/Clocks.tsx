import { useEffect, useState } from 'react';
import type { Color } from 'chess.js';
import { useGame } from '../store';
import { ARMY } from '../game/characters';
import { formatClock } from '../game/timeControls';

/**
 * The two war-hourglasses. Self-contained: it owns a light interval that ticks
 * the display and trips the flag when a side runs out — so the store isn't
 * written to on every frame, keeping the render loop clear.
 */
export function Clocks() {
  const whiteMs = useGame((s) => s.whiteMs);
  const blackMs = useGame((s) => s.blackMs);
  const clockSince = useGame((s) => s.clockSince);
  const turn = useGame((s) => s.turn);
  const gameOver = useGame((s) => s.gameOver);
  const mode = useGame((s) => s.mode);
  const playerColor = useGame((s) => s.playerColor);
  const flagClock = useGame((s) => s.flagClock);

  const timed = whiteMs != null;
  const [, force] = useState(0);

  useEffect(() => {
    if (!timed) return;
    const id = setInterval(() => {
      const s = useGame.getState();
      if (s.gameOver || s.clockSince == null) {
        force((n) => n + 1);
        return;
      }
      // trip the flag authoritatively from live time
      const elapsed = Date.now() - s.clockSince;
      const liveW = s.turn === 'w' ? (s.whiteMs ?? 0) - elapsed : s.whiteMs ?? 0;
      const liveB = s.turn === 'b' ? (s.blackMs ?? 0) - elapsed : s.blackMs ?? 0;
      if (liveW <= 0) flagClock('w');
      else if (liveB <= 0) flagClock('b');
      else force((n) => n + 1);
    }, 120);
    return () => clearInterval(id);
  }, [timed, flagClock]);

  if (!timed) return null;

  const running = !gameOver && clockSince != null;
  const elapsed = running ? Date.now() - clockSince : 0;
  const liveW = Math.max(0, (whiteMs ?? 0) - (turn === 'w' && running ? elapsed : 0));
  const liveB = Math.max(0, (blackMs ?? 0) - (turn === 'b' && running ? elapsed : 0));

  // "You" sit at the bottom; the opponent's clock rides above.
  const bottom: Color = mode === 'ai' ? playerColor : 'w';
  const top: Color = bottom === 'w' ? 'b' : 'w';
  const ms = (c: Color) => (c === 'w' ? liveW : liveB);

  const chip = (c: Color, place: string) => {
    const value = ms(c);
    const active = running && turn === c;
    const low = value < 20_000;
    return (
      <div className={`clock ${place} ${c === 'w' ? 'ram' : 'lanka'} ${active ? 'active' : ''} ${low ? 'low' : ''}`}>
        <span className="clock-army">{ARMY[c].en}</span>
        <span className="clock-time">{formatClock(value)}</span>
      </div>
    );
  };

  return (
    <div className="clocks">
      {chip(top, 'top')}
      {chip(bottom, 'bottom')}
    </div>
  );
}
