import type { Color, Move, PieceSymbol, Square } from 'chess.js';

/**
 * A piece with a stable identity across the whole game, so the 3D layer can
 * animate the same mesh gliding between squares instead of teleporting
 * fen-derived pieces around.
 */
export interface TrackedPiece {
  id: number;
  type: PieceSymbol;
  color: Color;
  square: Square;
}

export interface BoardDerivation {
  pieces: TrackedPiece[];
  /** Black pieces taken by white, in capture order. */
  capturedByWhite: PieceSymbol[];
  /** White pieces taken by black, in capture order. */
  capturedByBlack: PieceSymbol[];
}

const BACK_RANK: PieceSymbol[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
const FILES = 'abcdefgh';

/** Replay a verbose move history from the standard start position. */
export function derivePieces(history: Move[]): BoardDerivation {
  const pieces: TrackedPiece[] = [];
  let nextId = 0;
  for (let f = 0; f < 8; f++) {
    pieces.push({ id: nextId++, type: BACK_RANK[f], color: 'w', square: `${FILES[f]}1` as Square });
    pieces.push({ id: nextId++, type: 'p', color: 'w', square: `${FILES[f]}2` as Square });
    pieces.push({ id: nextId++, type: 'p', color: 'b', square: `${FILES[f]}7` as Square });
    pieces.push({ id: nextId++, type: BACK_RANK[f], color: 'b', square: `${FILES[f]}8` as Square });
  }

  const capturedByWhite: PieceSymbol[] = [];
  const capturedByBlack: PieceSymbol[] = [];

  const at = (square: string) => pieces.find((p) => p.square === square);
  const remove = (piece: TrackedPiece) => pieces.splice(pieces.indexOf(piece), 1);

  for (const move of history) {
    if (move.flags.includes('e')) {
      // en passant: the captured pawn sits on the to-file at the from-rank
      const victim = at(move.to[0] + move.from[1]);
      if (victim) {
        (move.color === 'w' ? capturedByWhite : capturedByBlack).push(victim.type);
        remove(victim);
      }
    } else if (move.flags.includes('c')) {
      const victim = at(move.to);
      if (victim) {
        (move.color === 'w' ? capturedByWhite : capturedByBlack).push(victim.type);
        remove(victim);
      }
    }

    const mover = at(move.from);
    if (!mover) continue; // should never happen with a valid history
    mover.square = move.to;
    if (move.promotion) mover.type = move.promotion;

    const rank = move.color === 'w' ? '1' : '8';
    if (move.flags.includes('k')) {
      const rook = at(`h${rank}`);
      if (rook) rook.square = `f${rank}` as Square;
    } else if (move.flags.includes('q')) {
      const rook = at(`a${rank}`);
      if (rook) rook.square = `d${rank}` as Square;
    }
  }

  return { pieces, capturedByWhite, capturedByBlack };
}
