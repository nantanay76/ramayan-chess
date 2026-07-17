import { create } from 'zustand';
import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import { ChessGame, type GameOver } from './game/chess';
import { derivePieces, type TrackedPiece } from './game/pieceTracker';
import { LEVELS, armyStyle } from './engine/difficulty';
import { getAiMove, startNewEngineGame, stopEngine, evaluatePosition, bestMoveFor, configureEnginePower, type EnginePower } from './engine/ai';
import { classifyMove, type Ev, type MoveQuality } from './game/moveQuality';
import { UNLIMITED, type TimeControl } from './game/timeControls';
import { loadProfile, saveProfile, applyResult, type Profile } from './game/profile';
import { battleQuote, type QuoteEvent } from './game/quotes';
import { evaluateAchievements } from './game/achievements';
import { playSound, playCaptureVoice, setSoundEnabled, startMusic, stopMusic, setMusicIntensity } from './audio/sounds';

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

const UI_KEY = 'rc:ui';
interface UiPrefs {
  showMoveDots: boolean;
  showCoords: boolean;
  panelCollapsed: boolean;
  topDownSeen: boolean;
  soundOn: boolean;
  musicOn: boolean;
}
const UI_DEFAULTS: UiPrefs = {
  showMoveDots: true,
  showCoords: true,
  panelCollapsed: false,
  topDownSeen: false,
  soundOn: true,
  musicOn: true,
};
function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<UiPrefs>;
      return {
        showMoveDots: p.showMoveDots !== false,
        showCoords: p.showCoords !== false,
        panelCollapsed: p.panelCollapsed === true,
        topDownSeen: p.topDownSeen === true,
        soundOn: p.soundOn !== false,
        musicOn: p.musicOn !== false,
      };
    }
  } catch {
    // unavailable or corrupt JSON — fall through to defaults
  }
  return { ...UI_DEFAULTS };
}
function saveUiPrefs(p: UiPrefs): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(p));
  } catch {
    // best-effort persistence
  }
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
  /** Transient system message toast (e.g. a declined draw offer, a battle cry). */
  notice: { seq: number; en: string; hi: string; glyph?: string } | null;
  /** Trophies earned by the game that just ended — shown in the game-over
   *  modal; empty otherwise. */
  lastUnlocks: { en: string; hi: string; desc: string }[];
  /** Divine-counsel hint: the best-move squares to shimmer on the board. */
  hint: { from: Square; to: Square } | null;
  hintsLeft: number;
  hintPending: boolean;
  /** One draw offer per game (vs computer). */
  drawOffered: boolean;
  showMoveDots: boolean;
  showCoords: boolean;
  /** Desktop battle-scroll panel collapsed to enlarge the board. */
  panelCollapsed: boolean;
  /** True once the player has tried the top-down view — kills the attention pulse. */
  topDownSeen: boolean;

  startGame(mode: Mode, levelIdx: number, playerColor: Color, timeControl?: TimeControl): void;
  backToMenu(): void;
  flagClock(color: Color): void;
  clickSquare(square: Square): void;
  clearSelection(): void;
  choosePromotion(piece: PieceSymbol): void;
  cancelPromotion(): void;
  undoMove(): void;
  resign(): void;
  requestHint(): void;
  offerDraw(): void;
  toggleMoveDots(): void;
  toggleCoords(): void;
  togglePanelCollapsed(): void;
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

  /** Merge-and-persist a UI pref change (single writer for the rc:ui key). */
  function setUiPref(patch: Partial<UiPrefs>): void {
    const s = get();
    const next: UiPrefs = {
      showMoveDots: s.showMoveDots,
      showCoords: s.showCoords,
      panelCollapsed: s.panelCollapsed,
      topDownSeen: s.topDownSeen,
      soundOn: s.soundOn,
      musicOn: s.musicOn,
      ...patch,
    };
    saveUiPrefs(next);
    set(next);
  }

  /** Fold a finished vs-computer game into the persistent campaign profile. */
  function finalizeResult(over: GameOver): void {
    const s = get();
    // lastResult doubles as a fired-once latch: every game-end path funnels
    // here, and a second call for the same game must not double-apply rating.
    if (s.mode !== 'ai' || s.lastResult) return;
    const score = !over.winner ? 0.5 : over.winner === s.playerColor ? 1 : 0;
    const ratingBefore = s.profile.rating;
    const { profile, ratingDelta, newlyConquered } = applyResult(s.profile, s.levelIdx, score);
    saveProfile(profile);
    const fresh = evaluateAchievements({
      profile,
      levelIdx: s.levelIdx,
      score,
      playerColor: s.playerColor,
      lostByPlayer: s.playerColor === 'w' ? s.capturedByBlack : s.capturedByWhite,
      timed: s.whiteMs != null,
      ratingBefore,
    });
    set({
      profile,
      lastResult: { ratingDelta, newRating: profile.rating, newlyConquered },
      lastUnlocks: fresh.map((a) => ({ en: a.en, hi: a.hi, desc: a.desc })),
    });
  }

  /** Occasional themed battle cry — throttled so it stays a garnish. */
  let lastQuotePly = -99;
  function maybeQuote(ev: QuoteEvent): void {
    const ply = get().history.length;
    if (ply - lastQuotePly < 6 || Math.random() >= 0.4) return;
    lastQuotePly = ply;
    set({ notice: { seq: ++noteSeq, ...battleQuote(ev) } });
  }

  function resetQuotes(): void {
    lastQuotePly = -99;
  }

  function applyMove(from: Square, to: Square, promotion?: PieceSymbol): boolean {
    // A finished game accepts no further moves — e.g. a promotion confirmed
    // after the flag already fell must not resurrect the game.
    if (get().gameOver) return false;
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
      maybeQuote('check');
    } else if (move.flags.includes('c') || move.flags.includes('e')) {
      playSound('capture');
      playCaptureVoice(move.color);
      maybeQuote(move.color === 'w' ? 'capture-ram' : 'capture-lanka');
    } else {
      playSound('move');
    }

    set({ ...snap, selected: null, targets: [], promotionPending: null, gameOver: over, thinking: false, hint: null });
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
    updateMusicIntensity();
    return true;
  }

  /** Feed the adaptive score: 0.15 is meditative calm, 1 is full war. Reads
   *  only already-derived state, so it's safe to call after any set(). */
  function updateMusicIntensity(): void {
    const s = get();
    if (s.gameOver || s.screen !== 'game') {
      setMusicIntensity(0.15);
      return;
    }
    const caps = s.capturedByWhite.length + s.capturedByBlack.length;
    const evalTension = s.evalMate != null ? 1 : s.evalCp != null ? Math.min(1, Math.abs(s.evalCp) / 400) : 0;
    const lowClock =
      s.clockSince != null &&
      ((s.whiteMs != null && s.whiteMs < 20000) || (s.blackMs != null && s.blackMs < 20000));
    const v =
      0.15 +
      0.2 * Math.min(1, s.history.length / 16) +
      (s.inCheck ? 0.25 : 0) +
      0.2 * evalTension +
      0.15 * Math.min(1, caps / 8) +
      (lowClock ? 0.25 : 0);
    setMusicIntensity(v);
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
        if (token === evalToken) {
          set({ evalCp: res.cp, evalMate: res.mate });
          updateMusicIntensity();
        }
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
        // The theatrical pause is ours, not the AI's — hand its clock the time back.
        const since = get().clockSince;
        if (wait > 0 && since != null) set({ clockSince: since + wait });
        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        const promotion = uci.length > 4 ? (uci[4] as PieceSymbol) : undefined;
        applyMove(from, to, promotion);
      })
      .catch((err) => {
        console.error('Engine failure:', err);
        if (token === aiToken) {
          // Freeze the clock too — a dead engine must not win or lose on time.
          set({ thinking: false, engineError: 'The engine could not move. Try a new game.', clockSince: null });
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
    enginePower: loadEnginePower(),
    evalCp: 0,
    evalMate: null,
    annotations: [],
    lastNote: null,
    profile: loadProfile(),
    lastResult: null,
    lastUnlocks: [],
    timeControl: UNLIMITED,
    whiteMs: null,
    blackMs: null,
    incrementMs: 0,
    clockSince: null,
    graphicsPref: loadGraphicsPref(),
    sceneReady: false,
    engineError: null,
    notice: null,
    hint: null,
    hintsLeft: 3,
    hintPending: false,
    drawOffered: false,
    ...loadUiPrefs(),

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
        lastUnlocks: [],
        notice: null,
        hint: null,
        hintsLeft: 3,
        hintPending: false,
        drawOffered: false,
        timeControl: tc,
        whiteMs: timed ? tc.initialMs : null,
        blackMs: timed ? tc.initialMs : null,
        incrementMs: tc.incrementMs,
        clockSince: timed ? Date.now() : null,
        flipped: mode === 'ai' && playerColor === 'b',
      });
      // The "begin battle" click is the user gesture autoplay policy wants.
      if (get().musicOn) startMusic();
      updateMusicIntensity();
      resetQuotes();
      scheduleEval();
      if (mode === 'ai') {
        configureEnginePower(get().enginePower);
        set({ thinking: true });
        const token = aiToken;
        startNewEngineGame(LEVELS[levelIdx])
          .then(() => {
            if (token !== aiToken || get().screen !== 'game') return;
            // Engine cold-start time shouldn't come off anyone's clock.
            set({ thinking: false, clockSince: get().clockSince != null ? Date.now() : null });
            maybeAiMove();
          })
          .catch((err) => {
            console.error('Engine failed to start:', err);
            if (token !== aiToken || get().screen !== 'game') return;
            // Freeze the clock — an engine that never loaded must not flag.
            set({ thinking: false, engineError: 'Could not load the chess engine.', clockSince: null });
          });
      }
    },

    backToMenu() {
      aiToken++;
      gameGen++;
      stopEngine();
      set({ screen: 'menu', selected: null, targets: [], promotionPending: null, thinking: false, clockSince: null });
      updateMusicIntensity();
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
        promotionPending: null,
        evalMate: winner === 'w' ? 1 : -1,
        evalCp: null,
        ...flagged,
      });
      finalizeResult(over);
      updateMusicIntensity();
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
      const undone: Color[] = [s.history[s.history.length - 1].color];
      game.undo();
      // vs computer: rewind the AI reply too, back to the player's turn
      if (s.mode === 'ai' && game.turn() !== s.playerColor && game.history().length > 0) {
        undone.push(s.history[s.history.length - 2].color);
        game.undo();
      }
      // Claw back the increment banked on each undone move — otherwise
      // move+undo cycles farm free time in increment games. Floored so a
      // low clock is never pushed into an instant flag.
      let whiteMs = s.whiteMs;
      let blackMs = s.blackMs;
      if (whiteMs != null && blackMs != null && s.incrementMs > 0) {
        for (const c of undone) {
          if (c === 'w') whiteMs = Math.max(Math.min(whiteMs, 1000), whiteMs - s.incrementMs);
          else blackMs = Math.max(Math.min(blackMs, 1000), blackMs - s.incrementMs);
        }
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
        notice: null,
        hint: null,
        // undoing past a finished game re-arms the finalize latch — the
        // replayed ending is a genuinely new result
        lastResult: null,
        lastUnlocks: [],
        whiteMs,
        blackMs,
        // hand the running clock to the side now on the move (no elapsed time restored)
        clockSince: whiteMs != null ? Date.now() : null,
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
        promotionPending: null,
        evalMate: winner === 'w' ? 1 : -1,
        evalCp: null,
        clockSince: null,
      });
      finalizeResult(over);
      updateMusicIntensity();
    },

    requestHint() {
      const s = get();
      if (s.screen !== 'game' || s.gameOver || s.promotionPending || s.hintPending || s.hintsLeft <= 0) return;
      if (s.mode === 'ai' && s.turn !== s.playerColor) return;
      const gen = gameGen;
      set({ hintPending: true });
      void bestMoveFor(game.fen())
        .then((uci) => {
          if (gen !== gameGen || get().screen !== 'game' || !uci) return;
          playSound('select');
          set({
            hint: { from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square },
            hintsLeft: get().hintsLeft - 1,
          });
        })
        .catch(() => {
          // counsel is best-effort — a failed engine just stays silent
        })
        .finally(() => {
          if (gen === gameGen) set({ hintPending: false });
        });
    },

    offerDraw() {
      const s = get();
      if (s.screen !== 'game' || s.gameOver || s.mode !== 'ai' || s.drawOffered) return;
      set({ drawOffered: true });
      // The AI accepts only a genuinely level position past the opening —
      // an edge, a mate score, or a premature offer is turned down.
      const level = s.evalMate === null && s.evalCp != null && Math.abs(s.evalCp) <= 60;
      if (level && s.history.length >= 20) {
        aiToken++;
        evalToken++;
        stopEngine();
        playSound('draw');
        const over: GameOver = { reason: 'draw-agreed', winner: null };
        set({
          gameOver: over,
          thinking: false,
          selected: null,
          targets: [],
          promotionPending: null,
          hint: null,
          evalCp: 0,
          evalMate: null,
          clockSince: null,
        });
        finalizeResult(over);
        updateMusicIntensity();
      } else {
        const lankaAi = s.playerColor === 'w';
        set({
          notice: lankaAi
            ? { seq: ++noteSeq, en: 'Ravana scorns your truce', hi: 'रावण ने संधि ठुकराई' }
            : { seq: ++noteSeq, en: "Shri Ram's army fights on", hi: 'युद्ध जारी रहेगा' },
        });
      }
    },

    toggleMoveDots() {
      setUiPref({ showMoveDots: !get().showMoveDots });
    },

    toggleCoords() {
      setUiPref({ showCoords: !get().showCoords });
    },

    togglePanelCollapsed() {
      setUiPref({ panelCollapsed: !get().panelCollapsed });
    },

    flipBoard() {
      set({ flipped: !get().flipped });
    },

    toggleTopDownView() {
      if (!get().topDownSeen) setUiPref({ topDownSeen: true });
      set({ topDownView: !get().topDownView });
    },

    toggleSound() {
      const on = !get().soundOn;
      setSoundEnabled(on);
      setUiPref({ soundOn: on });
    },

    toggleMusic() {
      const on = !get().musicOn;
      if (on) startMusic();
      else stopMusic();
      setUiPref({ musicOn: on });
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

// Honor a persisted mute — the sounds module defaults to enabled.
setSoundEnabled(useGame.getState().soundOn);
