import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { QUALITY_META } from '../game/moveQuality';

interface Toast {
  seq: number;
  className: string;
  glyph: string;
  label: string;
  hi: string;
}

/**
 * A brief chess.com-style verdict on the move you just played — "Brahmastra!",
 * "Blunder", "Best move" — themed to the epic. Also carries one-off system
 * notices (a declined draw offer). Shows for a moment, then fades.
 */
export function MoveToast() {
  const lastNote = useGame((s) => s.lastNote);
  const notice = useGame((s) => s.notice);
  const [shown, setShown] = useState<Toast | null>(null);

  useEffect(() => {
    if (!lastNote) return;
    const meta = QUALITY_META[lastNote.quality];
    setShown({ seq: lastNote.seq, className: meta.className, glyph: meta.glyph, label: meta.label, hi: meta.hi });
    const t = setTimeout(() => setShown(null), 1900);
    return () => clearTimeout(t);
  }, [lastNote?.seq, lastNote]);

  useEffect(() => {
    if (!notice) return;
    setShown({ seq: notice.seq, className: 'q-best', glyph: notice.glyph ?? '⚔', label: notice.en, hi: notice.hi });
    const t = setTimeout(() => setShown(null), 2400);
    return () => clearTimeout(t);
  }, [notice?.seq, notice]);

  if (!shown) return null;

  return (
    <div key={shown.seq} className={`move-toast ${shown.className}`}>
      <span className="move-toast-glyph">{shown.glyph}</span>
      <span className="move-toast-text">
        <span className="move-toast-label">{shown.label}</span>
        <span className="move-toast-hi">{shown.hi}</span>
      </span>
    </div>
  );
}
