import type { Square } from 'chess.js';

/**
 * Board is 8x8 unit squares centered on the origin; +z faces the default
 * camera and rank 1 sits on the +z side. Board orientation (flip) is a
 * rotation of the whole board group, not a coordinate remap.
 */
export function squareToWorld(square: Square): [number, number] {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return [file - 3.5, 3.5 - rank];
}

export const SQUARES: Square[] = (() => {
  const out: Square[] = [];
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      out.push((String.fromCharCode(97 + f) + String(r + 1)) as Square);
    }
  }
  return out;
})();

export function isDarkSquare(square: Square): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = square.charCodeAt(1) - 49;
  return (file + rank) % 2 === 0;
}
