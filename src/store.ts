import { create } from 'zustand';
import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import { ChessGame, type GameOver } from './game/chess';
import { derivePieces, type TrackedPiece } from './game/pieceTracker';
import { LEVELS } from './engine/difficulty';
import { getAiMove, startNewEngineGame, stopEngine } from './engine/ai';
import { playSound, playCaptureVoice, setSoundEnabled, startMusic, stopMusic } from './audio/sounds';

export type Mode = 'ai' | 'local';
export type Screen = 'menu' | 'game';

const game = new ChessGame();
/** Bumped to invalidate any in-flight AI search (undo, new game, menu…). */
let aiToken = 0;

interface BoardSnapshot {
  fen: string;
  turn: Color;
  inCheck: boolean;
  checkSquare: Square | null;
  pieces: TrackedPiece[];
  capturedByWhite: PieceSymbol[];
  capturedByBlack: PieceSymbol[];
  lastMove: { from: Square; to: Square } | null;
  history: Move[];
}

function snapshot(): BoardSnapshot {
  const history = game.history();
  const { pieces, capturedByWhite, capturedByBlack } = derivePieces(history);
  const last = history.length ? history[history.length - 1] : null;
  const inCheck = game.inCheck();
  return {
    fen: game.fen(),
    turn: game.turn(),
    inCheck,
    checkSquare: inCheck ? game.kingSquare(game.turn()) : null,
    pieces,
    capturedByWhite,
    capturedByBlack,
    lastMove: last ? { from: last.from, to: last.to } : null,
    history,
  };
}

export interface GameStore extends BoardSnapshot {
  screen: Screen;
  mode: Mode;
  levelIdx: number;
  playerColor: Color;
  selected: Square | null;
  targets: Move[];
  promotionPending: { from: Square; to: Square } | null;
  gameOver: GameOver | null;
  thinking: boolean;
  flipped: boolean;
  topDownView: boolean;
  soundOn: boolean;
  musicOn: boolean;
  engineError: string | null;

  startGame(mode: Mode, levelIdx: number, playerColor: Color): void;
  backToMenu(): void;
  clickSquare(square: Square): void;
  clearSelection(): void;
  choosePromotion(piece: PieceSymbol): void;
  cancelPromotion(): void;
  undoMove(): void;
  resign(): void;
  flipBoard(): void;
  toggleTopDownView(): void;
  toggleSound(): void;
  toggleMusic(): void;
}

export const useGame = create<GameStore>((set, get) => {
  function aiColor(): Color {
    return get().playerColor === 'w' ? 'b' : 'w';
  }

  function applyMove(from: Square, to: Square, promotion?: PieceSymbol): boolean {
    const move = game.tryMove(from, to, promotion);
    if (!move) return false;
    const snap = snapshot();
    const over = game.gameOver();

    if (over) {
      if (!over.winner) playSound('draw');
      else if (get().mode === 'local' || over.winner === get().playerColor) playSound('win');
      else playSound('lose');
    } else if (snap.inCheck) {
      playSound('check');
    } else if (move.flags.includes('c') || move.flags.includes('e')) {
      playSound('capture');
      playCaptureVoice(move.color);
    } else {
      playSound('move');
    }

    set({ ...snap, selected: null, targets: [], promotionPending: null, gameOver: over, thinking: false });
    if (!over) maybeAiMove();
    return true;
  }

  function maybeAiMove(): void {
    const s = get();
    if (s.screen !== 'game' || s.mode !== 'ai' || s.gameOver) return;
    if (game.turn() !== aiColor()) return;

    const level = LEVELS[s.levelIdx];
    const token = ++aiToken;
    set({ thinking: true });
    const legal = game.allMoves().map((m) => m.from + m.to + (m.promotion ?? ''));
    const started = Date.now();

    void getAiMove(level, game.fen(), legal)
      .then(async (uci) => {
        // keep a human-feeling minimum pause on instant replies
        const wait = Math.max(0, 650 - (Date.now() - started));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (token !== aiToken || get().screen !== 'game') return;
        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        const promotion = uci.length > 4 ? (uci[4] as PieceSymbol) : undefined;
        applyMove(from, to, promotion);
      })
      .catch((err) => {
        console.error('Engine failure:', err);
        if (token === aiToken) {
          set({ thinking: false, engineError: 'The engine could not move. Try a new game.' });
        }
      });
  }

  return {
    screen: 'menu',
    mode: 'ai',
    levelIdx: 0,
    playerColor: 'w',
    ...snapshot(),
    selected: null,
    targets: [],
    promotionPending: null,
    gameOver: null,
    thinking: false,
    flipped: false,
    topDownView: false,
    soundOn: true,
    musicOn: false,
    engineError: null,

    startGame(mode, levelIdx, playerColor) {
      aiToken++;
      stopEngine();
      game.reset();
      set({
        screen: 'game',
        mode,
        levelIdx,
        playerColor,
        ...snapshot(),
        selected: null,
        targets: [],
        promotionPending: null,
        gameOver: null,
        thinking: false,
        engineError: null,
        flipped: mode === 'ai' && playerColor === 'b',
      });
      if (mode === 'ai') {
        set({ thinking: true });
        startNewEngineGame(LEVELS[levelIdx])
          .then(() => {
            set({ thinking: false });
            maybeAiMove();
          })
          .catch((err) => {
            console.error('Engine failed to start:', err);
            set({ thinking: false, engineError: 'Could not load the chess engine.' });
          });
      }
    },

    backToMenu() {
      aiToken++;
      stopEngine();
      set({ screen: 'menu', selected: null, targets: [], promotionPending: null, thinking: false });
    },

    clickSquare(square) {
      const s = get();
      if (s.screen !== 'game' || s.gameOver || s.promotionPending) return;
      if (s.mode === 'ai' && s.turn !== s.playerColor) return;

      const target = s.selected ? s.targets.find((m) => m.to === square) : undefined;
      if (target) {
        if (target.promotion) {
          set({ promotionPending: { from: target.from, to: target.to } });
          return;
        }
        applyMove(target.from, target.to);
        return;
      }

      const piece = game.get(square);
      if (piece && piece.color === s.turn) {
        if (s.selected === square) {
          set({ selected: null, targets: [] });
          return;
        }
        playSound('select');
        set({ selected: square, targets: game.movesFrom(square) });
      } else {
        set({ selected: null, targets: [] });
      }
    },

    clearSelection() {
      if (get().selected) set({ selected: null, targets: [] });
    },

    choosePromotion(piece) {
      const pending = get().promotionPending;
      if (!pending) return;
      applyMove(pending.from, pending.to, piece);
    },

    cancelPromotion() {
      set({ promotionPending: null, selected: null, targets: [] });
    },

    undoMove() {
      const s = get();
      if (s.screen !== 'game') return;
      aiToken++;
      stopEngine();
      if (s.history.length === 0) {
        set({ thinking: false });
        return;
      }
      game.undo();
      // vs computer: rewind the AI reply too, back to the player's turn
      if (s.mode === 'ai' && game.turn() !== s.playerColor && game.history().length > 0) {
        game.undo();
      }
      set({
        ...snapshot(),
        selected: null,
        targets: [],
        promotionPending: null,
        gameOver: null,
        thinking: false,
      });
      // e.g. player plays black and undid past move 1: white (AI) must move again
      if (s.mode === 'ai' && game.turn() !== s.playerColor) maybeAiMove();
    },

    resign() {
      const s = get();
      if (s.screen !== 'game' || s.gameOver) return;
      aiToken++;
      stopEngine();
      const winner: Color = s.mode === 'ai' ? (s.playerColor === 'w' ? 'b' : 'w') : s.turn === 'w' ? 'b' : 'w';
      playSound('lose');
      set({ gameOver: { reason: 'resign', winner }, thinking: false, selected: null, targets: [] });
    },

    flipBoard() {
      set({ flipped: !get().flipped });
    },

    toggleTopDownView() {
      set({ topDownView: !get().topDownView });
    },

    toggleSound() {
      const on = !get().soundOn;
      setSoundEnabled(on);
      set({ soundOn: on });
    },

    toggleMusic() {
      const on = !get().musicOn;
      if (on) startMusic();
      else stopMusic();
      set({ musicOn: on });
    },
  };
});
