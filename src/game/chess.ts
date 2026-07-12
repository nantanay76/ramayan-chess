import { Chess } from 'chess.js';
import type { Color, Move, PieceSymbol, Square } from 'chess.js';

export type GameOverReason =
  | 'checkmate'
  | 'stalemate'
  | 'insufficient'
  | 'threefold'
  | 'fifty-move'
  | 'resign';

export interface GameOver {
  reason: GameOverReason;
  winner: Color | null;
}

/** Thin wrapper around chess.js holding the single authoritative game. */
export class ChessGame {
  private chess = new Chess();

  reset(): void {
    this.chess.reset();
  }

  fen(): string {
    return this.chess.fen();
  }

  turn(): Color {
    return this.chess.turn();
  }

  get(square: Square) {
    return this.chess.get(square);
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  history(): Move[] {
    return this.chess.history({ verbose: true });
  }

  movesFrom(square: Square): Move[] {
    return this.chess.moves({ square, verbose: true });
  }

  allMoves(): Move[] {
    return this.chess.moves({ verbose: true });
  }

  tryMove(from: Square, to: Square, promotion?: PieceSymbol): Move | null {
    try {
      return this.chess.move({ from, to, promotion });
    } catch {
      return null;
    }
  }

  undo(): Move | null {
    return this.chess.undo();
  }

  kingSquare(color: Color): Square | null {
    for (const row of this.chess.board()) {
      for (const cell of row) {
        if (cell && cell.type === 'k' && cell.color === color) return cell.square;
      }
    }
    return null;
  }

  gameOver(): GameOver | null {
    if (this.chess.isCheckmate()) {
      return { reason: 'checkmate', winner: this.chess.turn() === 'w' ? 'b' : 'w' };
    }
    if (this.chess.isStalemate()) return { reason: 'stalemate', winner: null };
    if (this.chess.isInsufficientMaterial()) return { reason: 'insufficient', winner: null };
    if (this.chess.isThreefoldRepetition()) return { reason: 'threefold', winner: null };
    if (this.chess.isDraw()) return { reason: 'fifty-move', winner: null };
    return null;
  }
}
