// The flat pieces: each one is the side view of its turned marble twin, so the 2D board, the figurines in the
// notation and the 3D set read as one set. Drawn once at build time into a 100 x 100 box, base at the bottom.

import { HEIGHT, KING_CROSS, PROFILES, QUEEN_CROWN, knightOutline, type Kind } from './model.ts';

type P2 = [number, number];

/** Square units to box units: the king, cross included, stands 88 tall. */
const S = 52;
const CX = 50;
const BASE = 95;
const X = (x: number) => CX + x * S;
const Y = (y: number) => BASE - y * S;
const n2 = (v: number) => Math.round(v * 100) / 100;
const poly = (pts: P2[]) => 'M' + pts.map(([x, y]) => `${n2(X(x))} ${n2(Y(y))}`).join('L') + 'Z';
const rect = (cx: number, cy: number, w: number, h: number) =>
  poly([
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ]);
const circle = (cx: number, cy: number, r: number) => {
  const x = X(cx);
  const y = Y(cy);
  const rr = r * S;
  return `M${n2(x - rr)} ${n2(y)}a${n2(rr)} ${n2(rr)} 0 1 0 ${n2(2 * rr)} 0a${n2(rr)} ${n2(rr)} 0 1 0 ${n2(-2 * rr)} 0Z`;
};

/** The lathe profile seen from the side: right edge up, left edge back down. */
function body(kind: Kind, upTo = Infinity): string {
  const prof = PROFILES[kind].filter(([, y]) => y <= upTo);
  const right: P2[] = prof.map(([r, y]) => [r, y]);
  const left: P2[] = prof.map(([r, y]) => [-r, y] as P2).reverse();
  return poly([...right, ...left]);
}

export interface Silhouette {
  /** the solid shape: body and every part on it */
  shape: string;
  /** inner lines in the opposite tone: the bishop's mitre cut */
  detail: string;
}

function build(kind: Kind): Silhouette {
  if (kind === 'k') {
    const { stem, bar } = KING_CROSS;
    return { shape: body('k') + rect(0, stem.y, stem.w * 1.15, stem.h) + rect(0, bar.y, bar.w * 1.1, bar.h * 1.15), detail: '' };
  }
  if (kind === 'q') {
    const c = QUEEN_CROWN;
    // the crown's beads as the side view shows them, a little fuller so they read at small sizes
    const beads = [-1, -0.7, 0, 0.7, 1].map((k) => circle(k * c.r, c.y + 0.03, c.ball * 1.45)).join('');
    return { shape: body('q') + beads, detail: '' };
  }
  if (kind === 'r') {
    // three battlements read as a rook at any size (the turned rook shows two from any side)
    const merlons = [-0.17, 0, 0.17].map((x) => rect(x, 0.86 + 0.055, 0.1, 0.11)).join('');
    return { shape: body('r') + merlons, detail: '' };
  }
  if (kind === 'n') {
    // the head faces left, as knights do on a printed board
    const head: P2[] = knightOutline().map(([x, y]) => [-x, y]);
    const eye = circle(-0.12, 0.93, 0.028);
    return { shape: body('n') + poly(head), detail: eye };
  }
  if (kind === 'b') {
    // the mitre's slanted cut
    const cut = poly([
      [-0.02, 1.02],
      [0.11, 0.9],
      [0.125, 0.92],
      [-0.005, 1.04],
    ]);
    return { shape: body('b'), detail: cut };
  }
  return { shape: body('p'), detail: '' };
}

export const SILHOUETTES: Record<Kind, Silhouette> = {
  k: build('k'),
  q: build('q'),
  r: build('r'),
  b: build('b'),
  n: build('n'),
  p: build('p'),
};

/** Symbol ids in the sprite: `pc-w-k` is the white king. */
export const pieceId = (side: 'w' | 'b', kind: Kind) => `pc-${side}-${kind}`;
export const figurineId = (kind: Kind) => `fg-${kind}`;

/**
 * The sprite the layout inlines once. A piece is drawn twice: a wide stroke under the fill, so the outline only
 * shows outside the shape (the cross and the crown join the body without seams).
 */
export function pieceSprite(): string {
  const kinds: Kind[] = ['k', 'q', 'r', 'b', 'n', 'p'];
  let out = '';
  for (const kind of kinds) {
    const { shape, detail } = SILHOUETTES[kind];
    for (const side of ['w', 'b'] as const) {
      const edge = side === 'w' ? 'var(--piece-edge-w)' : 'var(--piece-edge-b)';
      const fill = side === 'w' ? 'var(--piece-fill-w)' : 'var(--piece-fill-b)';
      const line = side === 'w' ? 'var(--piece-edge-w)' : 'var(--piece-fill-w)';
      out +=
        `<symbol id="${pieceId(side, kind)}" viewBox="0 0 100 100">` +
        `<path d="${shape}" style="fill:${edge};stroke:${edge}" stroke-width="5" stroke-linejoin="round"/>` +
        `<path d="${shape}" style="fill:${fill}"/>` +
        (detail ? `<path d="${detail}" style="fill:${line}"/>` : '') +
        `</symbol>`;
    }
    // a figurine in a line of text is cropped to its own height, so a pawn and a king both fill the type size
    const top = Y(HEIGHT[kind]) - 3;
    out += `<symbol id="${figurineId(kind)}" viewBox="22 ${n2(top)} 56 ${n2(BASE + 2 - top)}"><path d="${shape}" fill="currentColor"/></symbol>`;
  }
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${out}</defs></svg>`;
}
