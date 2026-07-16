/** A chess clock setting. `initialMs === 0` means an untimed game (no clocks). */
export interface TimeControl {
  id: string;
  label: string;
  sub: string;
  initialMs: number;
  incrementMs: number;
}

const MIN = 60_000;

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'unlimited', label: 'Unlimited', sub: 'no clock', initialMs: 0, incrementMs: 0 },
  { id: 'rapid', label: 'Rapid', sub: '10 | 5', initialMs: 10 * MIN, incrementMs: 5_000 },
  { id: 'blitz5', label: 'Blitz', sub: '5 | 3', initialMs: 5 * MIN, incrementMs: 3_000 },
  { id: 'blitz3', label: 'Blitz', sub: '3 | 2', initialMs: 3 * MIN, incrementMs: 2_000 },
];

export const UNLIMITED = TIME_CONTROLS[0];

/** mm:ss, dropping to ss.d under ten seconds so the last breaths feel tense. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    return (clamped / 1000).toFixed(1);
  }
  const total = Math.ceil(clamped / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
