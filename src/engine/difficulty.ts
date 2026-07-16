/**
 * The 10-step ELO ladder.
 *
 * - `native` levels use Stockfish's own UCI_LimitStrength/UCI_Elo (floor 1320),
 *   which is well calibrated by the engine itself.
 * - `blunder` levels sit below that floor: shallow depth + low Skill Level +
 *   MultiPV candidates, from which we pick imperfect moves via softmax over
 *   the eval gap (plus an occasional outright random move) — the Lichess-bot
 *   recipe for believable beginners.
 * - `full` is unrestricted Stockfish with generous move time.
 */
export interface Level {
  elo: number;
  rank: string;
  rankHi: string;
  tagline: string;
  kind: 'blunder' | 'native' | 'full';
  movetime?: number;
  depth?: number;
  skill?: number;
  multipv?: number;
  /** Softmax temperature in centipawns — higher = wilder move choice. */
  temperature?: number;
  /** Chance of playing a completely random legal move. */
  randomChance?: number;
}

/**
 * The temperament the AI plays with. Not a strength dial — among moves the
 * engine already rates as near-best, an `aggressive` army reaches for captures,
 * checks and king-hunts, while a `classical` army keeps it sound and principled.
 */
export type Style = 'aggressive' | 'classical' | 'balanced';

/**
 * Ravana's army (black) fights ferociously; Shri Ram's army (white) fights with
 * dharmic restraint. The AI's temperament follows the army it commands.
 */
export function armyStyle(aiColor: 'w' | 'b'): Style {
  return aiColor === 'b' ? 'aggressive' : 'classical';
}

export const LEVELS: Level[] = [
  { elo: 500, rank: 'Shishya', rankHi: 'शिष्य', tagline: 'A young student of the game', kind: 'blunder', depth: 2, skill: 0, multipv: 6, temperature: 350, randomChance: 0.15 },
  { elo: 800, rank: 'Sainik', rankHi: 'सैनिक', tagline: 'A foot-soldier of the vanar sena', kind: 'blunder', depth: 3, skill: 1, multipv: 5, temperature: 220, randomChance: 0.06 },
  { elo: 1100, rank: 'Yoddha', rankHi: 'योद्धा', tagline: 'A seasoned warrior', kind: 'blunder', depth: 5, skill: 4, multipv: 4, temperature: 130, randomChance: 0.02 },
  { elo: 1400, rank: 'Dhanurdhar', rankHi: 'धनुर्धर', tagline: 'A trained archer', kind: 'native', movetime: 700 },
  { elo: 1700, rank: 'Sena Nayak', rankHi: 'सेना नायक', tagline: 'A commander of companies', kind: 'native', movetime: 800 },
  { elo: 2000, rank: 'Senapati', rankHi: 'सेनापति', tagline: 'A general of the army', kind: 'native', movetime: 900 },
  { elo: 2300, rank: 'Rathi', rankHi: 'रथी', tagline: 'A master charioteer-warrior', kind: 'native', movetime: 1000 },
  { elo: 2600, rank: 'Atirathi', rankHi: 'अतिरथी', tagline: 'Worth a thousand warriors', kind: 'native', movetime: 1200 },
  { elo: 2900, rank: 'Maharathi', rankHi: 'महारथी', tagline: 'Worth ten thousand warriors', kind: 'native', movetime: 1400 },
  { elo: 3200, rank: 'Brahmastra', rankHi: 'ब्रह्मास्त्र', tagline: 'Full Stockfish. The unstoppable weapon.', kind: 'full', movetime: 2500 },
];
