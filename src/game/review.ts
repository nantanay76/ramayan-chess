import type { Color, Move } from 'chess.js';
import { classifyMove, type Ev, type MoveQuality } from './moveQuality';
import type { MoveNote } from '../store';

export interface ReviewMove {
  ply: number;
  san: string;
  color: Color;
  /** Board position after this move, for the replay board. */
  fen: string | null;
  /** White's-perspective eval after this move (for the graph). */
  cpWhite: number | null;
  mate: number | null;
  cpLoss: number;
  quality: MoveQuality | null;
}

export interface SideReview {
  accuracy: number;
  brilliant: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
  /** The move that cost this side the most. */
  worst: ReviewMove | null;
}

export interface ReviewData {
  moves: ReviewMove[];
  w: SideReview;
  b: SideReview;
}

const OPENING: Ev = { cp: 20, mate: null };

function accuracyFromAcpl(acpl: number): number {
  // A gentle exponential: flawless ≈ 99, ACPL 50 ≈ 82, ACPL 200 ≈ 45.
  return Math.round(Math.min(99, Math.max(1, 100 * Math.exp(-acpl / 250))));
}

function sideReview(moves: ReviewMove[], color: Color): SideReview {
  const own = moves.filter((m) => m.color === color && m.quality != null);
  const acpl = own.length ? own.reduce((a, m) => a + m.cpLoss, 0) / own.length : 0;
  let worst: ReviewMove | null = null;
  for (const m of own) if (!worst || m.cpLoss > worst.cpLoss) worst = m;
  return {
    accuracy: accuracyFromAcpl(acpl),
    brilliant: own.filter((m) => m.quality === 'brahmastra').length,
    blunders: own.filter((m) => m.quality === 'blunder').length,
    mistakes: own.filter((m) => m.quality === 'mistake').length,
    inaccuracies: own.filter((m) => m.quality === 'inaccuracy').length,
    worst: worst && worst.cpLoss > 40 ? worst : null,
  };
}

/**
 * Turn the game's move list + per-ply evals (captured live, no re-analysis) into
 * a full graded review — accuracy for each army, the eval swing, and every move
 * scored the same way the live toast grades your own.
 */
export function buildReview(history: Move[], annotations: MoveNote[]): ReviewData {
  const moves: ReviewMove[] = [];
  for (let i = 0; i < history.length; i++) {
    const note = annotations[i];
    const color: Color = i % 2 === 0 ? 'w' : 'b';
    const beforeNote = i === 0 ? null : annotations[i - 1];
    const before: Ev = beforeNote ? { cp: beforeNote.cp, mate: beforeNote.mate } : OPENING;

    let cpLoss = 0;
    let quality: MoveQuality | null = null;
    if (note) {
      const r = classifyMove(before, { cp: note.cp, mate: note.mate }, color);
      cpLoss = r.cpLoss;
      quality = r.quality;
    }
    moves.push({
      ply: i,
      san: history[i].san,
      color,
      fen: note?.fen ?? null,
      cpWhite: note?.cp ?? null,
      mate: note?.mate ?? null,
      cpLoss,
      quality,
    });
  }
  return { moves, w: sideReview(moves, 'w'), b: sideReview(moves, 'b') };
}
