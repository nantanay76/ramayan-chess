import { useEffect, useState } from 'react';
import { useGame } from '../store';
import { QUALITY_META } from '../game/moveQuality';

/**
 * A brief chess.com-style verdict on the move you just played — "Brahmastra!",
 * "Blunder", "Best move" — themed to the epic. Shows for a moment, then fades.
 */
export function MoveToast() {
  const lastNote = useGame((s) => s.lastNote);
  const [shown, setShown] = useState<{ seq: number; quality: typeof QUALITY_META[keyof typeof QUALITY_META] & { key: string } } | null>(null);

  useEffect(() => {
    if (!lastNote) return;
    const meta = QUALITY_META[lastNote.quality];
    setShown({ seq: lastNote.seq, quality: { ...meta, key: lastNote.quality } });
    const t = setTimeout(() => setShown(null), 1900);
    return () => clearTimeout(t);
  }, [lastNote?.seq, lastNote]);

  if (!shown) return null;

  return (
    <div key={shown.seq} className={`move-toast ${shown.quality.className}`}>
      <span className="move-toast-glyph">{shown.quality.glyph}</span>
      <span className="move-toast-text">
        <span className="move-toast-label">{shown.quality.label}</span>
        <span className="move-toast-hi">{shown.quality.hi}</span>
      </span>
    </div>
  );
}
