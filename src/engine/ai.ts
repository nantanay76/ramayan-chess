import { UciEngine } from './uci';
import type { Level } from './difficulty';

let engine: UciEngine | null = null;
let configuredElo = -1;

async function ensureEngine(level: Level): Promise<UciEngine> {
  if (!engine) engine = new UciEngine();
  await engine.init();
  if (configuredElo !== level.elo) {
    await engine.setOptions({
      MultiPV: level.multipv ?? 1,
      'Skill Level': level.skill ?? 20,
      UCI_LimitStrength: level.kind === 'native',
      ...(level.kind === 'native' ? { UCI_Elo: level.elo } : {}),
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
}

/**
 * Ask the engine for a move at the given level.
 * @param legalUci every legal move in UCI form, used for random-blunder picks
 *   and to sanity-filter candidates.
 */
export async function getAiMove(level: Level, fen: string, legalUci: string[]): Promise<string> {
  const e = await ensureEngine(level);

  if (level.kind === 'blunder' && level.randomChance && Math.random() < level.randomChance) {
    // Random legal move; skip underpromotions so it stays merely bad, not absurd.
    const pool = legalUci.filter((m) => m.length === 4 || m.endsWith('q'));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) return pick;
  }

  const go = level.kind === 'blunder' ? `depth ${level.depth}` : `movetime ${level.movetime}`;
  const { bestmove, candidates } = await e.search(fen, go);
  if (level.kind !== 'blunder' || candidates.length <= 1) return bestmove;

  const legal = new Set(legalUci);
  const ranked = candidates.filter((c) => legal.has(c.move));
  if (ranked.length === 0) return bestmove;

  const temperature = level.temperature ?? 150;
  const best = ranked[0].score;
  const weights = ranked.map((c) => Math.exp((c.score - best) / temperature));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ranked.length; i++) {
    r -= weights[i];
    if (r <= 0) return ranked[i].move;
  }
  return ranked[ranked.length - 1].move;
}
