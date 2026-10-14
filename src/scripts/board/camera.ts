// The camera over the marble board: where it stands (behind the side that plays), and how the whole board, the
// pieces on its far rank included, is framed inside the canvas.

import { BOARD, type Vec3 } from '../../lib/chess/model.ts';

export interface Rig {
  camera: Vec3;
  target: Vec3;
  right: Vec3;
  up: Vec3;
  fwd: Vec3;
}

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Azimuth 0 looks from white's side (+z) up the board; pi looks from black's. */
export function rigFor(azimuth: number, elevation: number, distance = 15, aim: Vec3 = [0, 0.35, 0]): Rig {
  const camera: Vec3 = [
    aim[0] + distance * Math.sin(azimuth) * Math.cos(elevation),
    aim[1] + distance * Math.sin(elevation),
    aim[2] + distance * Math.cos(azimuth) * Math.cos(elevation),
  ];
  const fwd = norm(sub(aim, camera));
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  return { camera, target: aim, fwd, right, up };
}

/** Camera-plane coordinates, what PerspectiveCamera.lookAt sees before fov and lens shift. */
export function project(rig: Rig, p: Vec3): [number, number] {
  const d = sub(p, rig.camera);
  const z = dot(d, rig.fwd);
  return [dot(d, rig.right) / z, dot(d, rig.up) / z];
}

/** What must stay in view: the frame at the floor and at the top, and room for tall pieces on every rank. Tight
 *  (a phone, straight from the seat or overhead): the playing field runs edge to edge across the screen and the
 *  frame's sides fall off it, as chess.com runs its board; the near and far frame stay. `crop` (the low photographic
 *  view on a phone) keeps only that share of the board's width in view, so the board runs off both sides of the
 *  screen as in a close photograph. */
export function boardBounds(rig: Rig, tight = false, extra: Vec3[] = [], crop = 1) {
  const F = BOARD.half + BOARD.frame;
  const X = crop < 1 ? BOARD.half * crop : tight ? BOARD.half + 0.04 : F;
  const pts: Vec3[] = [];
  for (const x of [-X, X]) for (const z of [-F, F]) {
    pts.push([x, 0, z], [x, BOARD.top, z]);
    // a king standing on the corner square
    pts.push([x * 0.88, BOARD.top + 1.75, z * 0.88]);
  }
  // anything else that must stay in view for a while (the chess box opening on the table, the pieces beside it)
  pts.push(...extra);
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const p of pts) {
    const [u, v] = project(rig, p);
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  return { u0, u1, v0, v1 };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Field of view and lens shift that centre the bounds inside a box of a W x H canvas (the part the broadcast
 * graphics leave free), whichever side binds. setViewOffset(W, H, ox, oy, W, H) moves the picture by (ox, oy).
 */
export function frameBounds(b: { u0: number; u1: number; v0: number; v1: number }, W: number, H: number, box: Box = { x: 0, y: 0, w: W, h: H }) {
  const bw = b.u1 - b.u0;
  const bh = b.v1 - b.v0;
  const s = Math.min(box.w / bw, box.h / bh);
  const fov = (2 * Math.atan(H / 2 / s) * 180) / Math.PI;
  const bx = box.x + (box.w - bw * s) / 2;
  const by = box.y + (box.h - bh * s) / 2;
  const ox = W / 2 + b.u0 * s - bx;
  const oy = H / 2 - b.v1 * s - by;
  return { fov, ox, oy, scale: s };
}
