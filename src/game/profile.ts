import { LEVELS } from '../engine/difficulty';

/** The player's persistent campaign record, saved to localStorage. */
export interface Profile {
  /** Personal ELO, seeded near the foot of the ladder. */
  rating: number;
  /** Highest LEVELS index defeated — the conquest frontier (-1 = none yet). */
  highestConquered: number;
  wins: number;
  losses: number;
  draws: number;
  /** Current unbroken win streak. */
  streak: number;
  bestStreak: number;
}

const KEY = 'rc:profile';

export const DEFAULT_PROFILE: Profile = {
  rating: 600,
  highestConquered: -1,
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
};

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    // corrupt or unavailable storage — start fresh
  }
  return { ...DEFAULT_PROFILE };
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // best-effort — a failed write just means it won't survive reload
  }
}

/** The themed rank the player has earned, read off the ladder by their rating. */
export function playerRank(rating: number): { rank: string; rankHi: string } {
  let best = LEVELS[0];
  for (const l of LEVELS) if (rating >= l.elo) best = l;
  return { rank: best.rank, rankHi: best.rankHi };
}

export interface ResultOutcome {
  profile: Profile;
  ratingDelta: number;
  /** True when this win pushed the conquest frontier to a new rank. */
  newlyConquered: boolean;
}

/**
 * Fold a finished game (score: 1 win / 0.5 draw / 0 loss, from the player's
 * side) into the profile — an ELO update against the rung's strength, streaks,
 * and the conquest frontier.
 */
export function applyResult(profile: Profile, levelIdx: number, score: number): ResultOutcome {
  const levelElo = LEVELS[levelIdx].elo;
  const expected = 1 / (1 + 10 ** ((levelElo - profile.rating) / 400));
  const K = 32;
  const ratingDelta = Math.round(K * (score - expected));
  const win = score === 1;
  const draw = score === 0.5;

  const streak = win ? profile.streak + 1 : 0;
  const newlyConquered = win && levelIdx > profile.highestConquered;

  const next: Profile = {
    rating: Math.max(100, profile.rating + ratingDelta),
    highestConquered: newlyConquered ? levelIdx : profile.highestConquered,
    wins: profile.wins + (win ? 1 : 0),
    losses: profile.losses + (!win && !draw ? 1 : 0),
    draws: profile.draws + (draw ? 1 : 0),
    streak,
    bestStreak: Math.max(profile.bestStreak, streak),
  };
  return { profile: next, ratingDelta, newlyConquered };
}
