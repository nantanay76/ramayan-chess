import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { PieceSymbol } from 'chess.js';

export type Army = 'ram' | 'lanka';

export interface PieceGeo {
  main: THREE.BufferGeometry;
  accent: THREE.BufferGeometry;
  height: number;
}

/*
 * Every piece keeps its classic, instantly-readable chess silhouette and layers
 * Ramayana character motifs on top:
 *   King    — Shri Ram (crown + Kodanda bow)   / Ravana (tiered ten-crown, horns)
 *   Queen   — Sita ji (lotus-petal crown)      / Mandodari (spiked dark crown)
 *   Bishop  — Hanuman ji (raised gada + tail)  / Ahiravan (hooded cowl + trident)
 *   Knight  — Lakshman (horse + quiver)        / Indrajit (horse + serpent coil)
 *   Rook    — Jamvant (stone fortress rings)   / Kumbhakarna (bulky spiked tower)
 *   Pawn    — Vanar (headband + curled tail)   / Rakshasa (tiny horns)
 */

function lathe(profile: Array<[number, number]>, segments = 36): THREE.BufferGeometry {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}

function place(
  geo: THREE.BufferGeometry,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  ry = 0,
  rz = 0,
  scale = 1,
): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(scale, scale, scale),
  );
  geo.applyMatrix4(m);
  return geo;
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const normalized = parts.map((g) => {
    const nonIndexed = g.index ? g.toNonIndexed() : g;
    // mergeGeometries requires identical attribute sets; drop everything but the basics
    const keep = ['position', 'normal', 'uv'];
    for (const name of Object.keys(nonIndexed.attributes)) {
      if (!keep.includes(name)) nonIndexed.deleteAttribute(name);
    }
    return nonIndexed;
  });
  const merged = mergeGeometries(normalized, false);
  return merged ?? normalized[0];
}

/** Shared plinth: a rounded temple-pedestal foot. */
function basePlinth(r: number): Array<[number, number]> {
  return [
    [0.001, 0],
    [r, 0],
    [r, 0.035],
    [r * 0.94, 0.07],
    [r * 0.72, 0.115],
    [r * 0.64, 0.15],
  ];
}

function ringTorus(r: number, tube: number, y: number, arc = Math.PI * 2): THREE.BufferGeometry {
  return place(new THREE.TorusGeometry(r, tube, 10, 36, arc), 0, y, 0, Math.PI / 2);
}

// ---------------------------------------------------------------- pawn

function buildPawn(army: Army): PieceGeo {
  const main: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];

  main.push(
    lathe([
      ...basePlinth(0.27),
      [0.135, 0.2],
      [0.11, 0.3],
      [0.155, 0.36],
      [0.115, 0.4],
    ]),
  );
  main.push(place(new THREE.SphereGeometry(0.145, 24, 18), 0, 0.5));

  // brow band for both armies
  accent.push(ringTorus(0.125, 0.02, 0.545));

  if (army === 'ram') {
    // vanar tail curling around the base
    accent.push(place(new THREE.TorusGeometry(0.2, 0.024, 8, 28, Math.PI * 1.5), 0, 0.06, 0, Math.PI / 2, Math.PI * 0.6));
    accent.push(place(new THREE.SphereGeometry(0.032, 10, 8), -0.14, 0.13, -0.15));
  } else {
    // rakshasa horns
    accent.push(place(new THREE.ConeGeometry(0.032, 0.1, 10), -0.08, 0.62, 0, 0, 0, 0.35));
    accent.push(place(new THREE.ConeGeometry(0.032, 0.1, 10), 0.08, 0.62, 0, 0, 0, -0.35));
  }

  return { main: merge(main), accent: merge(accent), height: 0.65 };
}

// ---------------------------------------------------------------- rook

function buildRook(army: Army): PieceGeo {
  const main: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];
  const wide = army === 'lanka' ? 1.12 : 1;

  main.push(
    lathe([
      ...basePlinth(0.32 * wide),
      [0.245 * wide, 0.18],
      [0.215 * wide, 0.32],
      [0.215 * wide, 0.5],
      [0.26 * wide, 0.55],
      [0.275 * wide, 0.62],
      [0.24 * wide, 0.66],
      [0.001, 0.66],
    ]),
  );

  // crenellations — Ram: temple blocks; Lanka: spikes
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = Math.cos(a) * 0.22 * wide;
    const pz = Math.sin(a) * 0.22 * wide;
    if (army === 'ram') {
      main.push(place(new THREE.BoxGeometry(0.09, 0.1, 0.07), px, 0.71, pz, 0, -a));
    } else {
      main.push(place(new THREE.ConeGeometry(0.045, 0.14, 8), px, 0.73, pz));
    }
  }

  // fortress rings + emblem
  accent.push(ringTorus(0.222 * wide, 0.013, 0.26));
  accent.push(ringTorus(0.218 * wide, 0.013, 0.44));
  accent.push(place(new THREE.SphereGeometry(0.042, 14, 12), 0, 0.38, 0.225 * wide));

  return { main: merge(main), accent: merge(accent), height: 0.78 };
}

// ---------------------------------------------------------------- knight

function horseHeadShape(): THREE.Shape {
  const s = new THREE.Shape();
  const pts: Array<[number, number]> = [
    [0.12, 0.0],
    [0.1, 0.06],
    [0.15, 0.14],
    [0.2, 0.2],
    [0.29, 0.23],
    [0.315, 0.29],
    [0.28, 0.35],
    [0.16, 0.44],
    [0.09, 0.52],
    [0.05, 0.57],
    [0.01, 0.57],
    [-0.06, 0.67],
    [-0.065, 0.55],
    [-0.115, 0.52],
    [-0.1, 0.46],
    [-0.15, 0.38],
    [-0.22, 0.24],
    [-0.21, 0.1],
    [-0.16, 0.0],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}

function buildKnight(army: Army): PieceGeo {
  const main: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];

  main.push(
    lathe([
      ...basePlinth(0.3),
      [0.21, 0.16],
      [0.235, 0.185],
      [0.2, 0.21],
    ]),
  );

  const head = new THREE.ExtrudeGeometry(horseHeadShape(), {
    depth: 0.19,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  place(head, 0, 0.19, -0.095);
  main.push(head);

  // eyes
  accent.push(place(new THREE.SphereGeometry(0.024, 10, 8), 0.1, 0.64, 0.105));
  accent.push(place(new THREE.SphereGeometry(0.024, 10, 8), 0.1, 0.64, -0.105));

  if (army === 'ram') {
    // Lakshman's quiver on the back
    accent.push(place(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 12), -0.24, 0.32, 0, 0, 0, 0.45));
    accent.push(place(new THREE.ConeGeometry(0.02, 0.09, 8), -0.305, 0.47, 0.03, 0, 0, 0.45));
    accent.push(place(new THREE.ConeGeometry(0.02, 0.09, 8), -0.33, 0.45, -0.035, 0, 0, 0.45));
  } else {
    // Indrajit's serpent coiled around the front of the plinth
    accent.push(place(new THREE.TorusKnotGeometry(0.075, 0.016, 48, 8, 2, 3), 0, 0.1, 0.22, Math.PI / 2));
  }

  return { main: merge(main), accent: merge(accent), height: 0.86 };
}

// ---------------------------------------------------------------- bishop

function buildBishop(army: Army): PieceGeo {
  const main: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];

  main.push(
    lathe([
      ...basePlinth(0.29),
      [0.12, 0.2],
      [0.1, 0.42],
      [0.14, 0.5],
      [0.165, 0.56],
      [0.125, 0.63],
      [0.095, 0.66],
    ]),
  );

  if (army === 'ram') {
    // Hanuman ji: head, raised gada, tail sweeping around the plinth
    main.push(place(new THREE.SphereGeometry(0.115, 22, 16), 0, 0.74));
    accent.push(ringTorus(0.1, 0.018, 0.79)); // crown band
    // gada shaft angled from the shoulder
    accent.push(place(new THREE.CylinderGeometry(0.022, 0.028, 0.34, 10), 0.19, 0.82, 0, 0, 0, -0.45));
    accent.push(place(new THREE.SphereGeometry(0.095, 18, 14), 0.265, 0.975, 0));
    accent.push(place(new THREE.ConeGeometry(0.03, 0.07, 10), 0.265, 1.07, 0));
    // tail: hugs the body, rising behind and curling over
    accent.push(place(new THREE.TorusGeometry(0.13, 0.024, 8, 28, Math.PI * 1.35), 0, 0.3, -0.13, 0, 0, Math.PI * 0.55));
    accent.push(place(new THREE.SphereGeometry(0.03, 10, 8), 0.02, 0.44, -0.13));
  } else {
    // Ahiravan: pointed sorcerer's cowl + trident
    main.push(
      lathe([
        [0.095, 0.66],
        [0.13, 0.72],
        [0.1, 0.82],
        [0.03, 0.95],
        [0.001, 0.98],
      ]),
    );
    accent.push(ringTorus(0.115, 0.018, 0.7));
    const tx = -0.17;
    accent.push(place(new THREE.CylinderGeometry(0.016, 0.016, 0.42, 8), tx, 0.75, 0, 0, 0, 0.12));
    for (const [dx, h] of [
      [-0.05, 0.08],
      [0, 0.11],
      [0.05, 0.08],
    ] as const) {
      accent.push(place(new THREE.ConeGeometry(0.016, h, 8), tx - 0.024 + dx, 1.0, 0));
    }
  }

  return { main: merge(main), accent: merge(accent), height: army === 'ram' ? 1.1 : 1.05 };
}

// ---------------------------------------------------------------- queen

function buildQueen(army: Army): PieceGeo {
  const main: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];

  main.push(
    lathe([
      ...basePlinth(0.31),
      [0.185, 0.18],
      [0.14, 0.34],
      [0.115, 0.52],
      [0.135, 0.62],
      [0.16, 0.68],
      [0.115, 0.75],
      [0.13, 0.8],
      [0.09, 0.84],
    ]),
  );
  main.push(place(new THREE.SphereGeometry(0.105, 22, 16), 0, 0.92));

  accent.push(ringTorus(0.12, 0.02, 0.72)); // necklace

  if (army === 'ram') {
    // Sita ji: lotus-petal crown
    const petals = 8;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2;
      accent.push(
        place(
          new THREE.ConeGeometry(0.028, 0.11, 8),
          Math.cos(a) * 0.095,
          1.02,
          Math.sin(a) * 0.095,
          Math.sin(a) * 0.5,
          0,
          -Math.cos(a) * 0.5,
        ),
      );
    }
    accent.push(place(new THREE.SphereGeometry(0.035, 12, 10), 0, 1.06));
  } else {
    // Mandodari: sharp dark coronet
    const spikes = 6;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      main.push(
        place(new THREE.ConeGeometry(0.026, 0.13, 8), Math.cos(a) * 0.085, 1.03, Math.sin(a) * 0.085),
      );
    }
    accent.push(ringTorus(0.095, 0.018, 0.99));
    accent.push(place(new THREE.SphereGeometry(0.03, 12, 10), 0, 0.92, 0.095)); // brow gem
  }

  return { main: merge(main), accent: merge(accent), height: 1.1 };
}

// ---------------------------------------------------------------- king

function buildKing(army: Army): PieceGeo {
  const main: THREE.BufferGeometry[] = [];
  const accent: THREE.BufferGeometry[] = [];

  main.push(
    lathe([
      ...basePlinth(0.33),
      [0.2, 0.18],
      [0.15, 0.36],
      [0.125, 0.58],
      [0.15, 0.68],
      [0.18, 0.74],
      [0.125, 0.82],
      [0.145, 0.87],
      [0.1, 0.91],
    ]),
  );

  if (army === 'ram') {
    // Shri Ram: serene head, tall crown, the Kodanda bow at his side
    main.push(place(new THREE.SphereGeometry(0.115, 22, 16), 0, 0.99));
    accent.push(ringTorus(0.105, 0.022, 1.06));
    accent.push(place(new THREE.ConeGeometry(0.055, 0.14, 12), 0, 1.15));
    accent.push(place(new THREE.SphereGeometry(0.028, 10, 8), 0, 1.24));
    // bow: vertical arc + string, held against the robe
    accent.push(place(new THREE.TorusGeometry(0.15, 0.014, 8, 24, Math.PI * 1.1), 0.22, 0.5, 0, 0, 0, Math.PI * 0.45));
    accent.push(place(new THREE.CylinderGeometry(0.006, 0.006, 0.27, 6), 0.26, 0.5, 0, 0, 0, 0.12));
  } else {
    // Ravana: tiered crown suggesting the ten heads
    main.push(place(new THREE.CylinderGeometry(0.13, 0.145, 0.05, 20), 0, 0.945));
    main.push(place(new THREE.CylinderGeometry(0.1, 0.115, 0.05, 20), 0, 1.0));
    main.push(place(new THREE.CylinderGeometry(0.07, 0.085, 0.05, 20), 0, 1.055));
    accent.push(ringTorus(0.14, 0.016, 0.925));
    accent.push(ringTorus(0.11, 0.014, 0.98));
    const spikes = 5;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      accent.push(place(new THREE.ConeGeometry(0.02, 0.1, 8), Math.cos(a) * 0.055, 1.12, Math.sin(a) * 0.055));
    }
    accent.push(place(new THREE.SphereGeometry(0.035, 12, 10), 0, 1.14));
    accent.push(place(new THREE.SphereGeometry(0.026, 10, 8), 0, 0.87, 0.12)); // brow gem
  }

  return { main: merge(main), accent: merge(accent), height: army === 'ram' ? 1.26 : 1.19 };
}

// ---------------------------------------------------------------- cache

const cache = new Map<string, PieceGeo>();

export function pieceGeometry(type: PieceSymbol, army: Army): PieceGeo {
  const key = `${type}-${army}`;
  let geo = cache.get(key);
  if (!geo) {
    switch (type) {
      case 'p':
        geo = buildPawn(army);
        break;
      case 'r':
        geo = buildRook(army);
        break;
      case 'n':
        geo = buildKnight(army);
        break;
      case 'b':
        geo = buildBishop(army);
        break;
      case 'q':
        geo = buildQueen(army);
        break;
      default:
        geo = buildKing(army);
        break;
    }
    cache.set(key, geo);
  }
  return geo;
}
