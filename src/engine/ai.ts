import { UciEngine, SINGLE_THREAD_ENGINE, MULTI_THREAD_ENGINE } from './uci';
import type { Candidate } from './uci';
import type { Level, Style } from './difficulty';

let engine: UciEngine | null = null;
let configuredElo = -1;

/** 'standard' = single-threaded lite (default, no special headers needed);
 *  'max' = multi-threaded, opt-in, needs cross-origin isolation. */
export type EnginePower = 'standard' | 'max';
let enginePower: EnginePower = 'standard';

/** Whether the page is cross-origin isolated — the multi-thread build's
 *  SharedArrayBuffer requirement. False if the COOP/COEP headers didn't apply
 *  (e.g. an old browser, or a host that strips them). */
export function maxEngineAvailable(): boolean {
  return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated === true;
}

/**
 * Which Stockfish binary to load. The single-thread lite build only runs when
 * the page is NOT cross-origin isolated; the multi-thread build only runs when it
 * IS (it needs SharedArrayBuffer). So isolation — not the user's preference —
 * dictates the binary. When isolated we always use the multi build and just vary
 * the thread count, so "Standard" is the multi build pinned to a single thread.
 */
function engineFile(): string {
  return maxEngineAvailable() ? MULTI_THREAD_ENGINE : SINGLE_THREAD_ENGINE;
}

/** Search threads for the play engine: only >1 when the user opted into Max and
 *  isolation makes the multi-thread build available. */
function playThreads(): number {
  if (enginePower !== 'max' || !maxEngineAvailable()) return 1;
  const hw = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  // Cap at 4 so a strong engine never saturates every core — protects the FPS.
  return Math.max(1, Math.min(4, hw - 1));
}

/** Switch the play engine's binary (opt-in strength). Disposes the current one
 *  so the next game rebuilds with the right build; call it between games. */
export function configureEnginePower(p: EnginePower): void {
  if (p === enginePower) return;
  enginePower = p;
  engine?.terminate();
  engine = null;
  configuredElo = -1;
}

/**
 * Everything the move-picker needs to give a level its temperament. `aggr` maps
 * each legal UCI move to a static aggression score (captures / checks / king
 * proximity / pawn storms), computed by the caller which has the board handy.
 */
export interface AiContext {
  style: Style;
  aggr: Map<string, number>;
}

/** cp: among near-best moves only — we never trade real strength for flavour. */
const NATIVE_MARGIN = 30;
/** cp: how sharply eval loss is penalised inside the aggressive pick. */
const EVAL_TEMP = 55;
/** How much each army leans into its aggression score. */
const STYLE_FACTOR: Record<Style, number> = { aggressive: 1, balanced: 0.55, classical: 0.22 };

async function ensureEngine(level: Level): Promise<UciEngine> {
  if (!engine) engine = new UciEngine(engineFile());
  await engine.init();
  if (configuredElo !== level.elo) {
    const threads = playThreads();
    await engine.setOptions({
      // native/full now search several lines so the picker has candidates to
      // choose a temperament from; blunder levels keep their own wide MultiPV.
      MultiPV: level.multipv ?? (level.kind === 'blunder' ? 1 : 4),
      'Skill Level': level.skill ?? 20,
      UCI_LimitStrength: level.kind === 'native',
      ...(level.kind === 'native' ? { UCI_Elo: level.elo } : {}),
      Threads: threads,
      ...(threads > 1 ? { Hash: 64 } : {}),
    });
    configuredElo = level.elo;
  }
  return engine;
}

export async function startNewEngineGame(level: Level): Promise<void> {
  const e = await ensureEngine(level);
  await e.newGame();
}

export function stopEngine(): void {
  engine?.stop();
  // Also halt any in-flight analysis — its result would be dropped anyway
  // (gameGen), but a stale depth-12 search shouldn't keep burning CPU or
  // queue the next eval behind it.
  analyser?.stop();
}

// --- Analysis engine -------------------------------------------------------
// A second, full-strength worker used only for the eval bar and move-quality
// judgements. Kept separate from the play engine so (a) the score is objective
// regardless of the opponent's rung, and (b) evaluating never queues behind the
// AI's own (possibly long) search. Mates map to ±MATE_BASE in uci.ts.
const MATE_BASE = 100000;
let analyser: UciEngine | null = null;
let analyserReady = false;

export interface EvalResult {
  /** Centipawns from White's perspective (+ favours Ram); null when mating. */
  cp: number | null;
  /** Signed moves-to-mate from White's perspective (+ = Ram mates); else null. */
  mate: number | null;
}

async function ensureAnalyser(): Promise<UciEngine> {
  // Same binary rule as the play engine; the analyser stays single-thread (the
  // multi build's default Threads=1) so it's cheap and never contends for cores.
  if (!analyser) analyser = new UciEngine(engineFile());
  await analyser.init();
  if (!analyserReady) {
    await analyser.setOptions({ MultiPV: 1, UCI_LimitStrength: false, 'Skill Level': 20 });
    analyserReady = true;
  }
  return analyser;
}

/** Best move for the side to move — powers the "Divine Counsel" hint. Runs on
 *  the analyser worker so it never queues behind the opponent's search. */
export async function bestMoveFor(fen: string, depth = 14): Promise<string | null> {
  const e = await ensureAnalyser();
  const { bestmove } = await e.search(fen, `depth ${depth}`);
  return bestmove && bestmove.length >= 4 ? bestmove : null;
}

/** Shallow, objective evaluation of a position for the dharma-vs-adharma bar. */
export async function evaluatePosition(fen: string, depth = 12): Promise<EvalResult> {
  const e = await ensureAnalyser();
  const { candidates } = await e.search(fen, `depth ${depth}`);
  if (candidates.length === 0) return { cp: null, mate: null };
  const whiteToMove = fen.split(' ')[1] === 'w';
  const signed = whiteToMove ? candidates[0].score : -candidates[0].score;
  if (Math.abs(signed) >= MATE_BASE - 1000) {
    const dist = MATE_BASE - Math.abs(signed);
    return { cp: null, mate: signed > 0 ? dist : -dist };
  }
  return { cp: signed, mate: null };
}

/**
 * Ask the engine for a move at the given level.
 * @param legalUci every legal move in UCI form, used for random-blunder picks
 *   and to sanity-filter candidates.
 * @param ctx army temperament + per-move aggression scores (native/full only).
 */
export async function getAiMove(
  level: Level,
  fen: string,
  legalUci: string[],
  ctx?: AiContext,
): Promise<string> {
  const e = await ensureEngine(level);

  if (level.kind === 'blunder' && level.randomChance && Math.random() < level.randomChance) {
    // Random legal move; skip underpromotions so it stays merely bad, not absurd.
    const pool = legalUci.filter((m) => m.length === 4 || m.endsWith('q'));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) return pick;
  }

  const go = level.kind === 'blunder' ? `depth ${level.depth}` : `movetime ${level.movetime}`;
  const { bestmove, candidates } = await e.search(fen, go);

  const legal = new Set(legalUci);
  const ranked = candidates.filter((c) => legal.has(c.move));
  if (ranked.length <= 1) return bestmove;

  if (level.kind === 'blunder') {
    // Beginners: soft-pick across the whole candidate spread by eval gap.
    return weightedByEval(ranked, level.temperature ?? 150);
  }

  // native / full: play a near-best move, but let the army's temperament decide
  // which of the near-best moves — that is what reads as "aggressive like a bot".
  return pickWithTemperament(ranked, ctx);
}

function pickWithTemperament(ranked: Candidate[], ctx?: AiContext): string {
  const best = ranked[0].score;
  const pool = ranked.filter((c) => best - c.score <= NATIVE_MARGIN);
  if (pool.length <= 1 || !ctx) return ranked[0].move;

  const factor = STYLE_FACTOR[ctx.style];
  const weights = pool.map((c) => {
    const aggr = ctx.aggr.get(c.move) ?? 0;
    return Math.exp((c.score - best) / EVAL_TEMP + factor * aggr);
  });
  return weightedPick(pool.map((c) => c.move), weights);
}

function weightedByEval(ranked: Candidate[], temperature: number): string {
  const best = ranked[0].score;
  const weights = ranked.map((c) => Math.exp((c.score - best) / temperature));
  return weightedPick(ranked.map((c) => c.move), weights);
}

function weightedPick(moves: string[], weights: number[]): string {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < moves.length; i++) {
    r -= weights[i];
    if (r <= 0) return moves[i];
  }
  return moves[moves.length - 1];
}
