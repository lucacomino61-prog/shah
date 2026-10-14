// The set: a tournament Staunton, drawn finely enough to hold up close (Luca, 2026-10-14: "pices need to be more
// detailed"). Five pieces are turned, so they are lathed here from profiles cut with fillets, beads and coves the way a
// turner cuts them, with the details a lathe cannot make added after: the queen's coronet points, the rook's
// battlements, the bishop's mitre cut, the king's cross. The knight is carved, so it comes as a mesh (public/realism/
// knight.bin, from tools/knight-mesh.mjs). Every shape carries an `ao` attribute: how much the surface round a point
// closes over it, so the coves and grooves darken in the room's light as they do in a photograph.
//
// Measures follow a tournament set on 2.25 in squares (king 3.75 in, base 1.5 in), in squares: one square is 1.

import { BufferAttribute, BufferGeometry, ExtrudeGeometry, Shape, SphereGeometry, SplineCurve, Vector2 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Kind } from './types.ts';

export interface PieceShape {
  geometry: BufferGeometry;
  /** the widest radius, what it rests on lying down */
  girth: number;
  height: number;
}

type P = [number, number];

/** A turner's profile, drawn from the middle of the base outwards and up: straight runs, arcs, smooth curves. */
class Pen {
  pts: P[] = [];
  marks: Record<string, number> = {};
  constructor(r: number, y: number) {
    this.pts.push([r, y]);
  }
  get at(): P {
    return this.pts[this.pts.length - 1];
  }
  /** remember where the profile has got to (an index into the points) */
  mark(name: string) {
    this.marks[name] = this.pts.length - 1;
    return this;
  }
  to(r: number, y: number, n = 1) {
    const [r0, y0] = this.at;
    for (let i = 1; i <= n; i++) this.pts.push([r0 + ((r - r0) * i) / n, y0 + ((y - y0) * i) / n]);
    return this;
  }
  /** an arc round (cr, cy): angles from the outward direction, a quarter turn is straight up */
  arc(cr: number, cy: number, rad: number, a0: number, a1: number, n = 8) {
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.pts.push([cr + rad * Math.cos(a), cy + rad * Math.sin(a)]);
    }
    return this;
  }
  /** a hollow (a cove) from here to (r, y): a quarter ellipse whose centre lies outside the wood */
  cove(r: number, y: number, n = 12) {
    const [r0, y0] = this.at;
    for (let i = 1; i <= n; i++) {
      const t = ((Math.PI / 2) * i) / n;
      // narrowing upwards the centre is out and above; flaring upwards it is out and below
      if (r < r0) this.pts.push([r0 - (r0 - r) * Math.sin(t), y - (y - y0) * Math.cos(t)]);
      else this.pts.push([r - (r - r0) * Math.cos(t), y0 + (y - y0) * Math.sin(t)]);
    }
    return this;
  }
  /** a rounded shoulder (convex) from here to (r, y) */
  round(r: number, y: number, n = 10) {
    const [r0, y0] = this.at;
    for (let i = 1; i <= n; i++) {
      const t = ((Math.PI / 2) * i) / n;
      if (r < r0) this.pts.push([r + (r0 - r) * Math.cos(t), y0 + (y - y0) * Math.sin(t)]);
      else this.pts.push([r0 + (r - r0) * Math.sin(t), y - (y - y0) * Math.cos(t)]);
    }
    return this;
  }
  /** a long smooth curve through these points */
  curve(points: P[], n = 24) {
    const c = new SplineCurve([new Vector2(...this.at), ...points.map(([r, y]) => new Vector2(r, y))]);
    c.getPoints(n)
      .slice(1)
      .forEach((v) => this.pts.push([Math.max(0.0001, v.x), v.y]));
    return this;
  }
  /** the stem: narrowing from here to (r, y) along a gentle hollow, as turned stems are */
  stem(r: number, y: number, n = 18, bow = 2.3) {
    const [r0, y0] = this.at;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      this.pts.push([r + (r0 - r) * Math.pow(1 - t, bow), y0 + (y - y0) * t]);
    }
    return this;
  }
  /** a half-round bead standing out from a wall: from here, its top lands back at radius r */
  bead(rad: number, r = this.at[0]) {
    const [r0, y0] = this.at;
    return this.arc(r0, y0 + rad, rad, -Math.PI / 2, Math.PI / 2, 10).to(r, y0 + 2 * rad);
  }
  /** a disc: out along a sloping underside to its rounded rim, back in along a sloping top */
  disc(rim: number, thick: number, under: number, top: number, rIn: number) {
    const [, y0] = this.at;
    const e = thick / 2;
    this.cove(rim - e, y0 + under, 6);
    this.arc(rim - e, y0 + under + e, e, -Math.PI / 2, Math.PI / 2, 10);
    return this.cove(rIn, y0 + under + thick + top, 6);
  }
}

/** The common foot, as on the knight: a felted plinth with a rounded edge, a fine step, a bead, and a cove up to the
 *  stem. `s` scales its heights; it ends at radius 0.58 R. */
function foot(R: number, s: number): Pen {
  return new Pen(0.0001, 0)
    .to(R - 0.014, 0, 2)
    .arc(R - 0.014, 0.014, 0.014, -Math.PI / 2, 0, 5)
    .to(R, 0.046 * s)
    .arc(R - 0.016, 0.046 * s, 0.016, 0, Math.PI / 2, 6)
    .to(R * 0.905, 0.064 * s)
    .cove(R * 0.875, 0.078 * s, 4)
    .arc(R * 0.875, 0.078 * s + 0.024 * s, 0.024 * s, -Math.PI / 2, Math.PI / 2, 12)
    .to(R * 0.84, 0.128 * s)
    .cove(R * 0.58, 0.3 * s, 16);
}

/** How much the profile round each point closes over it: a hollow between a disc and the stem darkens, a rim stays
 *  open. Measured in the plane of the profile (the turned surface is the same all round). */
function profileShade(pts: P[], normals: P[], radius = 0.05): number[] {
  return pts.map((p, i) => {
    let sum = 0;
    let w = 0;
    for (let j = 0; j < pts.length; j++) {
      if (j === i) continue;
      const dx = pts[j][0] - p[0];
      const dy = pts[j][1] - p[1];
      const d = Math.hypot(dx, dy);
      if (d > radius || d < 1e-6) continue;
      const k = 1 - d / radius;
      sum += k * Math.max(0, (dx * normals[i][0] + dy * normals[i][1]) / d);
      w += k;
    }
    return Math.max(0.35, Math.min(1, 1 - (w ? sum / w : 0) * 1.8));
  });
}

/** The outward normal at each point of a profile (it runs up the outside, so the normal is the run turned clockwise). */
function profileNormals(pts: P[]): P[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dr = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dr, dy) || 1;
    return [dy / l, -dr / l] as P;
  });
}

const SEGMENTS = 96;

/** Turn a profile into a closed ring of faces (no seam: the last segment joins the first). `shape` may move the points
 *  of the profile rows between `from` and `to` (theta round the axis, j the row); those rows get their normals from the
 *  moved faces, the rest keep the profile's exact ones. */
function turn(pen: Pen, shape?: { from: number; to: number; move: (v: [number, number, number], theta: number, j: number) => void }): BufferGeometry {
  const pts = pen.pts;
  const n = pts.length;
  const S = SEGMENTS;
  const normals = profileNormals(pts);
  const shade = profileShade(pts, normals);
  const pos = new Float32Array(S * n * 3);
  const nor = new Float32Array(S * n * 3);
  const ao = new Float32Array(S * n);
  const v: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < S; i++) {
    const theta = (i / S) * Math.PI * 2;
    const s = Math.sin(theta);
    const c = Math.cos(theta);
    for (let j = 0; j < n; j++) {
      const k = i * n + j;
      v[0] = pts[j][0] * s;
      v[1] = pts[j][1];
      v[2] = pts[j][0] * c;
      if (shape && j >= shape.from && j <= shape.to) shape.move(v, theta, j);
      pos[k * 3] = v[0];
      pos[k * 3 + 1] = v[1];
      pos[k * 3 + 2] = v[2];
      nor[k * 3] = normals[j][0] * s;
      nor[k * 3 + 1] = normals[j][1];
      nor[k * 3 + 2] = normals[j][0] * c;
      ao[k] = shade[j];
    }
  }
  const index = new Uint32Array(S * (n - 1) * 6);
  let t = 0;
  for (let i = 0; i < S; i++) {
    const i2 = (i + 1) % S;
    for (let j = 0; j < n - 1; j++) {
      const a = i * n + j;
      const b = i2 * n + j;
      const c = i2 * n + j + 1;
      const d = i * n + j + 1;
      index[t++] = a;
      index[t++] = b;
      index[t++] = d;
      index[t++] = c;
      index[t++] = d;
      index[t++] = b;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex(new BufferAttribute(index, 1));
  if (shape) {
    // the moved rows (and one either side, where the faces bend) take the normals of their faces
    g.computeVertexNormals();
    const moved = g.getAttribute('normal') as BufferAttribute;
    for (let i = 0; i < S; i++)
      for (let j = shape.from - 1; j <= shape.to + 1; j++) {
        if (j < 0 || j >= n) continue;
        const k = i * n + j;
        nor[k * 3] = moved.getX(k);
        nor[k * 3 + 1] = moved.getY(k);
        nor[k * 3 + 2] = moved.getZ(k);
      }
  }
  g.setAttribute('normal', new BufferAttribute(nor, 3));
  g.setAttribute('ao', new BufferAttribute(ao, 1));
  return g;
}

/** A solid with an even `ao` (fully open), indexed, ready to merge with a turned body. */
function open(g: BufferGeometry): BufferGeometry {
  g.deleteAttribute('uv');
  const count = g.getAttribute('position').count;
  g.setAttribute('ao', new BufferAttribute(new Float32Array(count).fill(1), 1));
  const w = g.index ? g : mergeVertices(g, 1e-6);
  if (w !== g) g.dispose();
  return w;
}

function merge(parts: BufferGeometry[]): BufferGeometry {
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

// ---------------------------------------------------------------- the pieces

function pawn(): BufferGeometry {
  const p = foot(0.262, 0.8).stem(0.09, 0.47).disc(0.178, 0.034, 0.016, 0.012, 0.088).to(0.079, 0.552).mark('ball');
  // the head: a ball, from the neck round to the crown
  const cy = 0.7;
  const rad = 0.158;
  const a0 = -Math.acos(0.079 / rad);
  p.arc(0, cy, rad, a0, Math.PI / 2, 26);
  return turn(p);
}

function rook(): BufferGeometry {
  const p = foot(0.3, 0.9)
    .to(0.172, 0.29)
    .to(0.156, 0.6, 6)
    .bead(0.014)
    .to(0.158, 0.636)
    .cove(0.236, 0.79, 14)
    .round(0.246, 0.81, 5)
    .to(0.246, 0.9, 3)
    .round(0.232, 0.914, 5)
    .to(0.178, 0.914, 3)
    .arc(0.178, 0.904, 0.01, Math.PI / 2, Math.PI, 4)
    .to(0.168, 0.87, 2)
    .arc(0.158, 0.87, 0.01, 0, -Math.PI / 2, 4)
    .to(0.0001, 0.86, 3);
  const body = turn(p);
  // the battlements: six merlons round the rim, rounded at every edge
  const merlons: BufferGeometry[] = [];
  const bevel = 0.008;
  const count = 6;
  const gap = 0.36;
  for (let k = 0; k < count; k++) {
    const a0 = (k / count) * Math.PI * 2 + gap / 2;
    const a1 = ((k + 1) / count) * Math.PI * 2 - gap / 2;
    const r0 = 0.176 + bevel;
    const r1 = 0.246 - bevel;
    const s = new Shape();
    s.moveTo(r0 * Math.cos(a0), r0 * Math.sin(a0));
    s.absarc(0, 0, r1, a0, a1, false);
    s.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1));
    s.absarc(0, 0, r0, a1, a0, true);
    const g = new ExtrudeGeometry(s, { depth: 0.074, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
    // the shape lies in x-y and is pushed out along z: stand it up, its foot sunk into the rim
    g.rotateX(-Math.PI / 2).translate(0, 0.906, 0);
    merlons.push(open(g));
  }
  return merge([body, ...merlons]);
}

function bishop(): BufferGeometry {
  const p = foot(0.3, 0.95)
    .stem(0.088, 0.74)
    .disc(0.186, 0.028, 0.02, 0.006, 0.142)
    .disc(0.152, 0.02, 0.006, 0.012, 0.084)
    .to(0.074, 0.858)
    .mark('mitre')
    .curve(
      [
        [0.122, 0.884],
        [0.158, 0.935],
        [0.168, 0.995],
        [0.158, 1.065],
        [0.128, 1.135],
        [0.086, 1.192],
        [0.046, 1.226],
        [0.036, 1.238],
      ],
      44,
    )
    .mark('mitreTop')
    .round(0.046, 1.246, 4)
    .round(0.03, 1.262, 4)
    .to(0.028, 1.268);
  const cy = 1.305;
  const rad = 0.05;
  p.arc(0, cy, rad, -Math.acos(0.028 / rad), Math.PI / 2, 14);
  const m0 = p.marks.mitre;
  const m1 = p.marks.mitreTop;
  // the mitre's cut: a V-groove sawn in from the front, slanting down from the top
  const nx = Math.cos(0.62);
  const ny = Math.sin(0.62);
  return turn(p, {
    from: m0,
    to: m1,
    move: (v, theta) => {
      // the cut faces the front (+z), fading out round the sides
      const front = Math.cos(theta);
      if (front < 0.05) return;
      const d = (v[0] * nx + (v[1] - 1.05) * ny) / 1;
      const w = 0.024;
      if (Math.abs(d) > w) return;
      const depth = 0.07 * (1 - Math.abs(d) / w) * Math.min(1, (front - 0.05) * 3);
      const r = Math.hypot(v[0], v[2]) || 1;
      const k = Math.max(0.2, (r - depth) / r);
      v[0] *= k;
      v[2] *= k;
    },
  });
}

function queen(): BufferGeometry {
  const p = foot(0.325, 1)
    .stem(0.092, 0.87)
    .disc(0.205, 0.03, 0.022, 0.006, 0.155)
    .disc(0.164, 0.022, 0.006, 0.014, 0.088)
    .to(0.08, 0.99)
    .cove(0.21, 1.262, 18)
    .round(0.222, 1.282, 5)
    .mark('rim')
    .to(0.222, 1.3, 2)
    .to(0.222, 1.36, 6)
    .arc(0.206, 1.36, 0.016, 0, Math.PI, 12)
    .to(0.19, 1.31, 4)
    .mark('rimEnd')
    .to(0.17, 1.298, 2)
    .curve(
      [
        [0.13, 1.33],
        [0.09, 1.372],
        [0.062, 1.392],
      ],
      14,
    )
    .disc(0.07, 0.016, 0.004, 0.006, 0.04)
    .to(0.036, 1.42);
  const cy = 1.468;
  const rad = 0.058;
  p.arc(0, cy, rad, -Math.acos(0.036 / rad), Math.PI / 2, 16);
  const r0 = p.marks.rim;
  const r1 = p.marks.rimEnd;
  const POINTS = 8;
  const BASE = 1.3;
  // the coronet: the rim rises to eight points with rounded hollows between
  const lift = (theta: number) => 0.22 + 0.78 * Math.pow(1 - Math.abs(Math.sin((POINTS / 2) * theta)), 1.5);
  const body = turn(p, {
    from: r0 + 1,
    to: r1,
    move: (v, theta) => {
      if (v[1] > BASE) v[1] = BASE + (v[1] - BASE) * lift(theta);
    },
  });
  // a pearl on each point
  const pearls: BufferGeometry[] = [];
  for (let k = 0; k < POINTS; k++) {
    const a = (k / POINTS) * Math.PI * 2;
    const s = new SphereGeometry(0.021, 14, 10);
    s.translate(0.206 * Math.sin(a), 1.392, 0.206 * Math.cos(a));
    pearls.push(open(s));
  }
  return merge([body, ...pearls]);
}

function king(): BufferGeometry {
  const p = foot(0.34, 1.02)
    .stem(0.098, 0.95)
    .disc(0.218, 0.032, 0.024, 0.006, 0.165)
    .disc(0.176, 0.024, 0.006, 0.016, 0.094)
    .to(0.088, 1.078)
    .cove(0.2, 1.3, 18)
    .bead(0.016, 0.198)
    .round(0.15, 1.35, 6)
    .curve(
      [
        [0.11, 1.375],
        [0.074, 1.396],
      ],
      10,
    )
    .disc(0.082, 0.018, 0.004, 0.006, 0.05)
    .round(0.0001, 1.432, 6);
  const body = turn(p);
  // the cross pattée, its arms flaring at the ends, every edge rounded
  const s = new Shape();
  const w0 = 0.026;
  const L = 0.092;
  const top = 0.104;
  const low = 0.118;
  s.moveTo(-0.036, -low);
  s.lineTo(0.036, -low);
  s.lineTo(w0, -w0);
  s.lineTo(L, -0.042);
  s.lineTo(L, 0.042);
  s.lineTo(w0, w0);
  s.lineTo(0.042, top);
  s.lineTo(-0.042, top);
  s.lineTo(-w0, w0);
  s.lineTo(-L, 0.042);
  s.lineTo(-L, -0.042);
  s.lineTo(-w0, -w0);
  s.closePath();
  const bevel = 0.01;
  const cross = new ExtrudeGeometry(s, { depth: 0.044, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 });
  cross.translate(0, 1.42 + low, -0.022);
  return merge([body, open(cross)]);
}

/** The carved knight from its file (see tools/knight-mesh.mjs for the format). */
export function parseKnight(buf: ArrayBuffer): PieceShape {
  const hl = new DataView(buf).getUint32(0, true);
  const h = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as {
    count: number;
    indexCount: number;
    min: number[];
    max: number[];
    height: number;
    girth: number;
  };
  let o = 4 + hl;
  const q = new Int16Array(buf, o, h.count * 3);
  o += h.count * 6;
  const n8 = new Int8Array(buf, o, h.count * 3);
  o += Math.ceil((h.count * 3) / 4) * 4;
  const ind = new Uint16Array(buf, o, h.indexCount);
  o += Math.ceil(h.indexCount / 2) * 4;
  const ao8 = new Uint8Array(buf, o, h.count);
  const p = new Float32Array(h.count * 3);
  for (let i = 0; i < h.count * 3; i++) {
    const k = i % 3;
    p[i] = h.min[k] + ((q[i] + 32768) / 65535) * (h.max[k] - h.min[k]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(p, 3));
  g.setAttribute('normal', new BufferAttribute(n8, 3, true));
  g.setAttribute(
    'ao',
    new BufferAttribute(
      Float32Array.from(ao8, (v) => v / 255),
      1,
    ),
  );
  g.setIndex(new BufferAttribute(ind, 1));
  g.computeBoundingSphere();
  return { geometry: g, girth: 0.3, height: h.height };
}

const widest = (g: BufferGeometry) => {
  const p = g.getAttribute('position');
  let r = 0;
  let top = 0;
  for (let i = 0; i < p.count; i++) {
    r = Math.max(r, Math.hypot(p.getX(i), p.getZ(i)));
    top = Math.max(top, p.getY(i));
  }
  return { r, top };
};

/** The whole set: the five turned pieces made here, the knight from its file. */
export function stauntonSet(knight: PieceShape): Record<Kind, PieceShape> {
  const made = { p: pawn(), r: rook(), b: bishop(), q: queen(), k: king() };
  const out = { n: knight } as Record<Kind, PieceShape>;
  for (const [kind, g] of Object.entries(made) as [Kind, BufferGeometry][]) {
    g.computeBoundingSphere();
    const { r, top } = widest(g);
    out[kind] = { geometry: g, girth: r, height: top };
  }
  return out;
}
