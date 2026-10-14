// The marble set: board measures and the pieces' turned profiles. First drawn for LC/salvato; here the rules come
// from chess.js, so this file only keeps the shapes. The 3D board (scripts/board/board3d.ts), the flat pieces
// (silhouette.ts) and the figurines in the notation all start from these numbers.

export type Vec3 = [number, number, number];
export type Side = 'w' | 'b';
export type Kind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

/** One square is the unit. Files a..h run along +x, ranks 1..8 along -z: white sits nearest a camera at azimuth 0. */
export const BOARD = {
  /** half the playing surface */
  half: 4,
  /** height of the playing surface above the table: the board is one half of a folding box, about 3 cm deep */
  top: 0.55,
  /** the wooden frame around the squares: its width, and how far it stands below the marble */
  frame: 0.46,
  frameDrop: 0.035,
};

export const FILES = 'abcdefgh';
export const fileOf = (sq: number) => sq & 7;
export const rankOf = (sq: number) => sq >> 3;
export const square = (file: number, rank: number) => rank * 8 + file;
export const onBoard = (file: number, rank: number) => file >= 0 && file < 8 && rank >= 0 && rank < 8;
export const squareName = (sq: number) => FILES[fileOf(sq)] + (rankOf(sq) + 1);
export function parseSquare(name: string): number {
  const f = FILES.indexOf(name[0]);
  const r = Number(name[1]) - 1;
  if (f < 0 || !(r >= 0 && r < 8)) throw new Error(`bad square ${name}`);
  return square(f, r);
}
/** Centre of a square on the playing surface. */
export const squareCentre = (sq: number): Vec3 => [fileOf(sq) - 3.5, BOARD.top, 3.5 - rankOf(sq)];
export const isLight = (sq: number) => (fileOf(sq) + rankOf(sq)) % 2 === 1;

export const VALUE: Record<Kind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// ------------------------------------------------------------------ the turned pieces

/** A turned profile: [radius, height] from the centre of the base up to the crown, units of one square. */
export type Profile = [number, number][];

function arc(cy: number, r: number, from: number, to: number, n = 10): Profile {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / n;
    return [Math.max(0.0001, r * Math.cos(a)), cy + r * Math.sin(a)] as [number, number];
  });
}
/** The common foot: a felted base, a bead, a cove rising into the stem. */
function foot(k: number): Profile {
  return [
    [0.0001, 0],
    [0.34 * k, 0],
    [0.355 * k, 0.018],
    [0.355 * k, 0.058],
    [0.33 * k, 0.082],
    [0.336 * k, 0.106],
    [0.312 * k, 0.128],
    [0.262 * k, 0.15],
    [0.22 * k, 0.172],
  ];
}

export const PROFILES: Record<Kind, Profile> = {
  p: [...foot(0.86), [0.155, 0.27], [0.128, 0.4], [0.2, 0.435], [0.2, 0.47], [0.122, 0.5], ...arc(0.665, 0.182, -1.12, Math.PI / 2, 12)],
  r: [...foot(0.92), [0.21, 0.26], [0.185, 0.52], [0.195, 0.64], [0.255, 0.68], [0.255, 0.715], [0.225, 0.735], [0.235, 0.76], [0.245, 0.86], [0.0001, 0.86]],
  n: [...foot(0.94), [0.215, 0.26], [0.19, 0.31], [0.245, 0.34], [0.245, 0.375], [0.0001, 0.375]],
  b: [...foot(0.95), [0.17, 0.27], [0.118, 0.6], [0.212, 0.65], [0.212, 0.685], [0.112, 0.715], ...arc(0.925, 0.168, -1.25, 0.95, 12), [0.03, 1.165], ...arc(1.215, 0.056, -1.1, Math.PI / 2, 6)],
  q: [...foot(1.0), [0.182, 0.29], [0.122, 0.78], [0.222, 0.835], [0.222, 0.872], [0.122, 0.905], [0.128, 0.94], [0.235, 1.2], [0.258, 1.245], [0.2, 1.268], [0.15, 1.31], [0.07, 1.345], ...arc(1.408, 0.066, -1.0, Math.PI / 2, 6)],
  k: [...foot(1.05), [0.19, 0.29], [0.13, 0.86], [0.232, 0.912], [0.232, 0.95], [0.13, 0.985], [0.136, 1.02], [0.24, 1.27], [0.252, 1.305], [0.185, 1.335], [0.12, 1.395], [0.058, 1.428], [0.0001, 1.438]],
};

/** The parts a lathe can't turn, in the piece's own frame (y up, the knight facing +x). */
export const KING_CROSS = { stem: { w: 0.07, h: 0.27, y: 1.555 }, bar: { w: 0.21, h: 0.07, y: 1.6 } };
export const ROOK_MERLONS = { n: 4, r: 0.188, w: 0.125, h: 0.11, y: 0.86 };
export const QUEEN_CROWN = { n: 8, r: 0.245, y: 1.268, ball: 0.036 };
export const KNIGHT_HEAD = { base: 0.36, depth: 0.22, bevel: 0.035 };

/** The knight's head in side view, facing +x, as a closed outline from quadratic curves. */
export function knightOutline(n = 6): [number, number][] {
  // [control, end] pairs after a start point; a null control is a straight line
  const start: [number, number] = [-0.2, KNIGHT_HEAD.base];
  const segs: [[number, number] | null, [number, number]][] = [
    [[-0.31, 0.62], [-0.22, 0.9]],
    [[-0.18, 1.02], [-0.1, 1.07]],
    [null, [-0.07, 1.19]],
    [null, [0.0, 1.09]],
    [[0.08, 1.1], [0.16, 1.0]],
    [[0.3, 0.86], [0.355, 0.72]],
    [[0.4, 0.635], [0.33, 0.6]],
    [null, [0.24, 0.6]],
    [[0.16, 0.6], [0.12, 0.66]],
    [[0.04, 0.665], [0.05, 0.56]],
    [[0.14, 0.46], [0.2, KNIGHT_HEAD.base]],
  ];
  const out: [number, number][] = [start];
  let p = start;
  for (const [c, e] of segs) {
    if (!c) {
      out.push(e);
    } else {
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const d = t * t;
        out.push([a * p[0] + b * c[0] + d * e[0], a * p[1] + b * c[1] + d * e[1]]);
      }
    }
    p = e;
  }
  out.pop(); // the last point closes onto the start
  return out;
}

/** Height of a piece, crown included. */
export const HEIGHT: Record<Kind, number> = { p: 0.85, r: 0.97, n: 1.19, b: 1.27, q: 1.48, k: 1.69 };
/** Widest radius of a piece: what it rests on when it lies on its side. */
export const GIRTH: Record<Kind, number> = Object.fromEntries(
  (Object.keys(PROFILES) as Kind[]).map((k) => [k, Math.max(...PROFILES[k].map(([r]) => r))]),
) as Record<Kind, number>;
