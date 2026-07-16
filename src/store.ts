import { create } from 'zustand';
import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import { ChessGame, type GameOver } from './game/chess';
import { derivePieces, type TrackedPiece } from './game/pieceTracker';
import { LEVELS, armyStyle } from './engine/difficulty';
import { getAiMove, startNewEngineGame, stopEngine, evaluatePosition, configureEnginePower, type EnginePower } from './engine/ai';
import { classifyMove, type Ev, type MoveQuality } from './game/moveQuality';
import { UNLIMITED, type TimeControl } from './game/timeControls';
import { loadProfile, saveProfile, applyResult, type Profile } from './game/profile';
import { playSound, playCaptureVoice, setSoundEnabled, startMusic, stopMusic } from './audio/sounds';

export type Mode = 'ai' | 'local';
export type Screen = 'menu' | 'game';
export type { EnginePower } from './engine/ai';
/** 'auto' = adaptive PerformanceMonitor; the rest pin a fixed quality tier. */
export type GraphicsPref = 'auto' | 'ultra' | 'high' | 'balanced' | 'performance';

const game = new ChessGame();
/** Bumped to invalidate any in-flight AI search (undo, new game, menu…). */
let aiToken = 0;
/** Bumped on every eval so only the latest one wins the *bar* (evalCp/evalMate). */
let evalToken = 0;
/** Bumped only on structural resets (new game, menu, undo) so an in-flight eval
 *  from a superseded game/line is dropped — but plain later moves are not, since
 *  each ply's annotation stays valid regardless of newer positions. */
let gameGen = 0;
/** Monotonic id so the move-quality toast re-fires even on repeated qualities. */
let noteSeq = 0;

/** One analysed ply — powers the move-quality toast now and the War Review later. */
export interface MoveNote {
  /** History index (0-based) this note describes. */
  ply: number;
  /** Board position after this ply, for replay. */
  fen: string;
  /** White's-perspective eval after this ply (for the graph). */
  cp: number | null;
  mate: number | null;
  /** Set only for the human player's own moves. */
  quality?: MoveQuality;
  cpLoss?: number;
}

const GRAPHICS_KEY = 'rc:graphics';
function loadGraphicsPref(): GraphicsPref {
  try {
    const v = localStorage.getItem(GRAPHICS_KEY);
    if (v === 'auto' || v === 'ultra' || v === 'high' || v === 'balanced' || v === 'performance') {
      return v;
    }
  } catch {
    // localStorage may be unavailable (private mode) — fall through to default
  }
  return 'auto';
}

const ENGINE_KEY = 'rc:engine';
function loadEnginePower(): EnginePower {
  try {
    if (localStorage.getItem(ENGINE_KEY) === 'max') return 'max';
  } catch {
    // localStorage may be unavailable — fall through to the safe default
  }
  return 'standard';
}

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

/** Chebyshev (king-move) distance between two squares, e.g. 'e4' → 'g6'. */
function squareDist(a: Square, b: Square): number {
  return Math.max(
    Math.abs(a.charCodeAt(0) - b.charCodeAt(0)),
    Math.abs(a.charCodeAt(1) - b.charCodeAt(1)),
  );
}

/**
 * A static "how aggressive is this move" score used to give the AI a temperament.
 * Rewards captures, checks, moves that crowd the enemy king, and pawn storms —
 * the engine still only ever picks among moves it already rates as near-best.
 */
function aggressionOf(m: Move, enemyKing: Square | null, aiColor: Color): number {
  let s = 0;
  if (m.flags.includes('c') || m.flags.includes('e')) s += 1.0;
  if (m.san.includes('+') || m.san.includes('#')) s += 1.2;
  if (enemyKing) {
    const d = squareDist(m.to, enemyKing);
    if (d <= 1) s += 1.0;
    else if (d <= 2) s += 0.6;
    else if (d <= 3) s += 0.25;
  }
  if (m.piece === 'p') {
    const rank = m.to.charCodeAt(1) - '0'.charCodeAt(0);
    const advanced = aiColor === 'w' ? rank >= 5 : rank <= 4;
    if (advanced) s += 0.3;
  }
  return s;
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
  /** Opt-in engine strength: 'standard' (single-thread) or 'max' (multi-thread). */
  enginePower: EnginePower;
  /** Live position eval for the dharma-vs-adharma bar — White's-perspective cp. */
  evalCp: number | null;
  /** Signed moves-to-mate (+ = Ram mates) when a forced mate is seen; else null. */
  evalMate: number | null;
  /** Per-ply analysis, indexed by history ply — drives the review + graph. */
  annotations: MoveNote[];
  /** Transient move-quality flag for the toast; seq re-fires repeated qualities. */
  lastNote: { seq: number; quality: MoveQuality } | null;
  /** Persistent campaign record (rating, conquest frontier, streaks). */
  profile: Profile;
  /** Outcome of the just-finished AI game, for the game-over banner; null in a
   *  fresh/local game. */
  lastResult: { ratingDelta: number; newRating: number; newlyConquered: boolean } | null;
  /** The time control in force (persisted across rematches). */
  timeControl: TimeControl;
  /** Committed remaining time; null in an untimed game. Live time is these minus
   *  the time elapsed since `clockSince` for whichever side is on the move. */
  whiteMs: number | null;
  blackMs: number | null;
  incrementMs: number;
  /** Timestamp the on-move side's clock started running; null when idle/untimed. */
  clockSince: number | null;
  graphicsPref: GraphicsPref;
  /** true once the scene has warmed up (shaders compiled + exposure faded in) —
   *  the loading veil waits on this so the cold-start hitch stays hidden. */
  sceneReady: boolean;
  engineError: string | null;

  startGame(mode: Mode, levelIdx: number, playerColor: Color, timeControl?: TimeControl): void;
  backToMenu(): void;
  flagClock(color: Color): void;
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
  setGraphicsPref(pref: GraphicsPref): void;
  setEnginePower(power: EnginePower): void;
  setSceneReady(ready: boolean): void;
}

export const useGame = create<GameStore>((set, get) => {
  function aiColor(): Color {
    return get().playerColor === 'w' ? 'b' : 'w';
  }

  /** Bank the on-move side's elapsed time + increment when they complete a move,
   *  and hand the running clock to the other side (or stop it if the game ended). */
  function advanceClock(moverColor: Color, gameEnded: boolean): void {
    const s = get();
    if (s.whiteMs == null || s.clockSince == null) return; // untimed game
    const now = Date.now();
    const bank = moverColor === 'w' ? s.whiteMs : s.blackMs;
    const remaining = Math.max(0, (bank ?? 0) - (now - s.clockSince) + s.incrementMs);
    const nextSince = gameEnded ? null : now;
    if (moverColor === 'w') set({ whiteMs: remaining, clockSince: nextSince });
    else set({ blackMs: remaining, clockSince: nextSince });
  }

  /** Fold a finished vs-computer game into the persistent campaign profile. */
  function finalizeResult(over: GameOver): void {
    const s = get();
    if (s.mode !== 'ai') return;
    const score = !over.winner ? 0.5 : over.winner === s.playerColor ? 1 : 0;
    const { profile, ratingDelta, newlyConquered } = applyResult(s.profile, s.levelIdx, score);
    saveProfile(profile);
    set({ profile, lastResult: { ratingDelta, newRating: profile.rating, newlyConquered } });
  }

  function applyMove(from: Square, to: Square, promotion?: PieceSymbol): boolean {
    // Snapshot the eval of the position being moved from, so a human move can be
    // graded against the best play that eval already assumes.
    const before: Ev = { cp: get().evalCp, mate: get().evalMate };
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
    advanceClock(move.color, !!over);
    if (over) {
      // Freeze the meter on the result; drop any eval still in flight.
      evalToken++;
      const decisive = over.winner ? over.winner === 'w' ? 1 : -1 : null;
      if (over.winner) set({ evalMate: decisive, evalCp: null });
      else set({ evalCp: 0, evalMate: null });
      // Record the game-ending move so the review graph closes on the result.
      const ply = game.history().length - 1;
      if (ply >= 0) {
        const arr = get().annotations.slice();
        arr[ply] = { ply, fen: game.fen(), cp: over.winner ? null : 0, mate: decisive };
        set({ annotations: arr });
      }
      finalizeResult(over);
    } else {
      const isPlayerMove = get().mode === 'ai' && move.color === get().playerColor;
      scheduleEval(isPlayerMove ? { moverColor: move.color, before } : undefined);
      maybeAiMove();
    }
    return true;
  }

  /** Kick a best-effort eval of the current position for the meter. Cheap and
   *  off-thread; a newer move (bumping evalToken) silently drops a stale result.
   *  When `classify` is given (the human's own move) it also grades the move. */
  function scheduleEval(classify?: { moverColor: Color; before: Ev }): void {
    const token = ++evalToken;
    const gen = gameGen;
    const fen = game.fen();
    const ply = game.history().length - 1; // -1 at the opening position
    void evaluatePosition(fen)
      .then((res) => {
        // A structural reset (new game / menu / undo) invalidates this entirely.
        if (gen !== gameGen || get().screen !== 'game') return;

        // Record the ply's annotation — valid for *this* ply no matter how many
        // later moves have since landed, so nothing is lost during fast play.
        if (ply >= 0 && ply < game.history().length) {
          const note: MoveNote = { ply, fen, cp: res.cp, mate: res.mate };
          if (classify) {
            const { quality, cpLoss } = classifyMove(classify.before, res, classify.moverColor);
            note.quality = quality;
            note.cpLoss = cpLoss;
            set({ lastNote: { seq: ++noteSeq, quality } });
          }
          const arr = get().annotations.slice();
          arr[ply] = note;
          set({ annotations: arr });
        }

        // The bar shows the newest position only.
        if (token === evalToken) set({ evalCp: res.cp, evalMate: res.mate });
      })
      .catch(() => {
        // eval bar is non-essential — never let it surface an error
      });
  }

  function maybeAiMove(): void {
    const s = get();
    if (s.screen !== 'game' || s.mode !== 'ai' || s.gameOver) return;
    if (game.turn() !== aiColor()) return;

    const level = LEVELS[s.levelIdx];
    const token = ++aiToken;
    set({ thinking: true });

    const ai = aiColor();
    const enemyKing = game.kingSquare(s.playerColor);
    const verbose = game.allMoves();
    const legal: string[] = [];
    const aggr = new Map<string, number>();
    for (const m of verbose) {
      const uci = m.from + m.to + (m.promotion ?? '');
      legal.push(uci);
      aggr.set(uci, aggressionOf(m, enemyKing, ai));
    }
    const started = Date.now();

    void getAiMove(level, game.fen(), legal, { style: armyStyle(ai), aggr })
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
    enginePower: loadEnginePower(),
    evalCp: 0,
    evalMate: null,
    annotations: [],
    lastNote: null,
    profile: loadProfile(),
    lastResult: null,
    timeControl: UNLIMITED,
    whiteMs: null,
    blackMs: null,
    incrementMs: 0,
    clockSince: null,
    graphicsPref: loadGraphicsPref(),
    sceneReady: false,
    engineError: null,

    startGame(mode, levelIdx, playerColor, timeControl) {
      aiToken++;
      gameGen++;
      stopEngine();
      game.reset();
      const tc = timeControl ?? get().timeControl ?? UNLIMITED;
      const timed = tc.initialMs > 0;
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
        evalCp: 0,
        evalMate: null,
        annotations: [],
        lastNote: null,
        lastResult: null,
        timeControl: tc,
        whiteMs: timed ? tc.initialMs : null,
        blackMs: timed ? tc.initialMs : null,
        incrementMs: tc.incrementMs,
        clockSince: timed ? Date.now() : null,
        flipped: mode === 'ai' && playerColor === 'b',
      });
      scheduleEval();
      if (mode === 'ai') {
        configureEnginePower(get().enginePower);
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
      gameGen++;
      stopEngine();
      set({ screen: 'menu', selected: null, targets: [], promotionPending: null, thinking: false, clockSince: null });
    },

    flagClock(color) {
      const s = get();
      if (s.screen !== 'game' || s.gameOver || s.whiteMs == null) return;
      aiToken++;
      evalToken++;
      stopEngine();
      const winner: Color = color === 'w' ? 'b' : 'w';
      if (s.mode === 'local' || winner === s.playerColor) playSound('win');
      else playSound('lose');
      const flagged = color === 'w' ? { whiteMs: 0 } : { blackMs: 0 };
      const over: GameOver = { reason: 'timeout', winner };
      set({
        gameOver: over,
        clockSince: null,
        thinking: false,
        selected: null,
        targets: [],
        evalMate: winner === 'w' ? 1 : -1,
        evalCp: null,
        ...flagged,
      });
      finalizeResult(over);
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
      gameGen++;
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
        annotations: get().annotations.slice(0, game.history().length),
        lastNote: null,
        // hand the running clock to the side now on the move (no time restored)
        clockSince: get().whiteMs != null ? Date.now() : null,
      });
      scheduleEval();
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
      evalToken++;
      const over: GameOver = { reason: 'resign', winner };
      set({
        gameOver: over,
        thinking: false,
        selected: null,
        targets: [],
        evalMate: winner === 'w' ? 1 : -1,
        evalCp: null,
        clockSince: null,
      });
      finalizeResult(over);
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

    setGraphicsPref(pref) {
      try {
        localStorage.setItem(GRAPHICS_KEY, pref);
      } catch {
        // best-effort persistence — a failed write just means it won't survive reload
      }
      set({ graphicsPref: pref });
    },

    setEnginePower(power) {
      try {
        localStorage.setItem(ENGINE_KEY, power);
      } catch {
        // best-effort persistence
      }
      // Takes effect on the next game (startGame calls configureEnginePower),
      // so we never dispose an engine mid-search.
      set({ enginePower: power });
    },

    setSceneReady(ready) {
      if (get().sceneReady !== ready) set({ sceneReady: ready });
    },
  };
});
