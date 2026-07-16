import type { Color } from 'chess.js';

/** How good the player's move was, chess.com-style but themed to the epic. */
export type MoveQuality = 'brahmastra' | 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

export interface QualityMeta {
  label: string;
  hi: string;
  className: string;
  glyph: string;
}

export const QUALITY_META: Record<MoveQuality, QualityMeta> = {
  brahmastra: { label: 'Brahmastra!', hi: 'ब्रह्मास्त्र', className: 'q-brahmastra', glyph: '🏹' },
  best: { label: 'Best move', hi: 'श्रेष्ठ', className: 'q-best', glyph: '★' },
  good: { label: 'Good', hi: 'उत्तम', className: 'q-good', glyph: '✓' },
  inaccuracy: { label: 'Inaccuracy', hi: 'त्रुटि', className: 'q-inaccuracy', glyph: '?!' },
  mistake: { label: 'Mistake', hi: 'भूल', className: 'q-mistake', glyph: '?' },
  blunder: { label: 'Blunder', hi: 'महाभूल', className: 'q-blunder', glyph: '??' },
};

/** A position eval as it flows through the store: White's-perspective cp or mate. */
export interface Ev {
  cp: number | null;
  mate: number | null;
}

const MATE = 100000;

/** Collapse an eval to a single centipawn-ish number from the mover's side. */
export function moverScore(e: Ev, mover: Color): number {
  let white: number;
  if (e.mate != null) white = e.mate > 0 ? MATE - e.mate : -MATE - e.mate;
  else white = e.cp ?? 0;
  return mover === 'w' ? white : -white;
}

function hasMateFor(e: Ev, mover: Color): boolean {
  if (e.mate == null) return false;
  return mover === 'w' ? e.mate > 0 : e.mate < 0;
}

/**
 * Grade a move by how much ground it gave up versus best play (the "before"
 * eval already assumes the mover finds the best move, so any drop is the cost of
 * what was actually played). A genuine turning-point blow earns "Brahmastra".
 */
export function classifyMove(before: Ev, after: Ev, mover: Color): { quality: MoveQuality; cpLoss: number } {
  const b = moverScore(before, mover);
  const a = moverScore(after, mover);
  const cpLoss = Math.max(0, b - a);

  const newMate = hasMateFor(after, mover) && !hasMateFor(before, mover);
  const decisiveSwing = b < 150 && a >= 450; // from unclear/level to clearly winning
  if (cpLoss <= 25 && (newMate || decisiveSwing)) return { quality: 'brahmastra', cpLoss };

  if (cpLoss <= 20) return { quality: 'best', cpLoss };
  if (cpLoss <= 60) return { quality: 'good', cpLoss };
  if (cpLoss <= 130) return { quality: 'inaccuracy', cpLoss };
  if (cpLoss <= 280) return { quality: 'mistake', cpLoss };
  return { quality: 'blunder', cpLoss };
}
