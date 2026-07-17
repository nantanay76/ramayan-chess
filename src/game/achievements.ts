import type { Color, PieceSymbol } from 'chess.js';
import { LEVELS } from '../engine/difficulty';
import type { Profile } from './profile';

/** Everything a trophy test may inspect about a just-finished vs-AI game. */
export interface AchievementCtx {
  /** Profile AFTER the result was folded in. */
  profile: Profile;
  levelIdx: number;
  /** 1 win / 0.5 draw / 0 loss, from the player's side. */
  score: number;
  playerColor: Color;
  /** The player's own fallen pieces. */
  lostByPlayer: PieceSymbol[];
  timed: boolean;
  ratingBefore: number;
}

export interface Achievement {
  id: string;
  en: string;
  hi: string;
  desc: string;
  test(ctx: AchievementCtx): boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-win',
    en: 'First Victory',
    hi: 'प्रथम विजय',
    desc: 'Win your first battle against the computer',
    test: (c) => c.score === 1,
  },
  {
    id: 'streak-3',
    en: 'Three Arrows',
    hi: 'विजय त्रयी',
    desc: 'Win three battles in a row',
    test: (c) => c.profile.streak >= 3,
  },
  {
    id: 'streak-7',
    en: 'Relentless Tide',
    hi: 'अजेय प्रवाह',
    desc: 'Win seven battles in a row',
    test: (c) => c.profile.streak >= 7,
  },
  {
    id: 'giant-slayer',
    en: 'Giant Slayer',
    hi: 'दैत्य संहारक',
    desc: 'Defeat an opponent rated 400+ above you',
    test: (c) => c.score === 1 && LEVELS[c.levelIdx].elo - c.ratingBefore >= 400,
  },
  {
    id: 'flawless',
    en: 'Flawless War',
    hi: 'अखंड सेना',
    desc: 'Win without losing a single piece',
    test: (c) => c.score === 1 && c.lostByPlayer.length === 0,
  },
  {
    id: 'blitz-victor',
    en: 'Swift as Hanuman',
    hi: 'पवन-वेग विजय',
    desc: 'Win a timed battle',
    test: (c) => c.score === 1 && c.timed,
  },
  {
    id: 'lanka-ablaze',
    en: 'Lanka Ablaze',
    hi: 'लंका दहन',
    desc: 'Conquer half the ladder',
    test: (c) => c.profile.highestConquered >= Math.floor(LEVELS.length / 2),
  },
  {
    id: 'ravana-falls',
    en: 'Ravana Falls',
    hi: 'रावण वध',
    desc: 'Conquer the entire ladder — defeat Brahmastra itself',
    test: (c) => c.profile.highestConquered >= LEVELS.length - 1,
  },
];

const KEY = 'rc:achievements';

export function loadUnlocked(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === 'string'));
    }
  } catch {
    // corrupt or unavailable storage — start fresh
  }
  return new Set();
}

function saveUnlocked(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // best-effort persistence
  }
}

/** Test every locked trophy against the finished game; persists and returns
 *  the newly earned ones (id-set storage keeps this naturally idempotent). */
export function evaluateAchievements(ctx: AchievementCtx): Achievement[] {
  const have = loadUnlocked();
  const fresh = ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(ctx));
  if (fresh.length > 0) {
    for (const a of fresh) have.add(a.id);
    saveUnlocked(have);
  }
  return fresh;
}
