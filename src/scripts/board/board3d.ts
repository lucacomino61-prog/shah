// The marble board in three.js. It owns no animation loop: the page steps it from GSAP's ticker, and it draws
// only when something changed. Pieces, marble and lighting come from the Salvato board; here both sides play,
// every rule of chess applies (chess.js decides), and the commentator draws on the squares.

import {
  type Light,
  type Object3D,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  LatheGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Plane,
  PlaneGeometry,
  PointLight,
  Quaternion,
  Raycaster,
  RingGeometry,
  Scene,
  ShaderMaterial,
  ShadowMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SpotLight,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
  Vector3,
  VSMShadowMap,
  WebGLRenderer,
  type Material,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOARD, GIRTH, HEIGHT, KING_CROSS, KNIGHT_HEAD, PROFILES, QUEEN_CROWN, ROOK_MERLONS, knightOutline, type Vec3 } from '../../lib/chess/model.ts';
import { boardBounds, frameBounds, rigFor } from './camera.ts';
import { FILES, planMoves, readFen, type Arrow, type BoardOptions, type BoardView, type Kind, type Marks, type Placed, type Side, type Sq, type UnboxHooks } from './types.ts';
import { caseSound, fallSound, pieceDownSound, promoteSound } from '../../lib/sound.ts';
import { GLARE, boxUV, loadRoom, noGlare, photo, pieceMaterial, roomLight, squareMaps, type Realism, type Room } from './realism.ts';
import { createStill, type Still } from './still.ts';
import { createFocus, type Focus } from './focus.ts';
import { bankersLamp, books, candle, chessClock, coffeeCup, deskLamp, mug, notebook, phone, tumbler, type Kit } from './props.ts';
import { DEFAULT_WORLD, WORLDS, chosenSet, type PieceSetId, type PropId, type WorldDef, type WorldId } from './looks.ts';

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

/** The studio: one lamp over the board, the room dark around it. The same in day and night themes: the table is
 *  a place, not a page colour. */
const STUDIO = { room: 0.45, hemi: 0.34, lamp: 3.6, exposure: 1.04 };

/** Where the camera stands. First, the player's own seat: straight behind your pieces, looking down at about 60
 *  degrees, as someone sitting at the table sees the board (Luca, 2026-10-14: 80 degrees was "seen too much from
 *  above"; the room shows beyond the far edge of the table). Then straight overhead, and the low three-quarter the
 *  home page orbits in, which has a steeper version for an upright phone. dist is from the middle of the board, in
 *  squares. */
export const ANGLES = [
  { name: 'Si lojtar', upright: { el: 1.05, az: 0, dist: 14 }, wide: { el: 1.0, az: 0, dist: 14 } },
  { name: 'Nga lart', upright: { el: 1.54, az: 0, dist: 15 }, wide: { el: 1.54, az: 0, dist: 15 } },
  { name: 'Afër tabelës', upright: { el: 0.72, az: -0.42, dist: 15 }, wide: { el: 0.56, az: -0.5, dist: 15 } },
];

/** The home screen and the opening: a low three-quarter view, close, as the photographs in Chess Ultra and Pure Chess
 *  are taken, with the far side of the table out of focus (focus.ts). Luca, 2026-10-14: low on home, higher to play. */
export const CINEMA = { upright: { el: 0.42, az: -0.45, dist: 12 }, wide: { el: 0.34, az: -0.5, dist: 12 } };

/** How high a piece rides: under the pointer, chosen, in the hand. */
const LIFT = { hover: 0.05, chosen: 0.24, carry: 0.6 };
/** Springs: set down with the faintest overshoot; in the hand it follows close. */
const REST = { k: 170, c: 19 };
const CARRY = { k: 560, c: 42 };
const TILT = { k: 210, c: 17 };

type Mode = 'rest' | 'carry' | 'flight' | 'off' | 'stand';

interface Flight {
  t: number;
  dur: number;
  p0: Vector3;
  p1: Vector3;
  p2: Vector3;
  q0: Quaternion;
  q1: Quaternion;
  spin: number;
  delay: number;
  end: () => void;
}

interface Body {
  side: Side;
  kind: Kind;
  sq: Sq | null;
  group: Group;
  mesh: Mesh;
  /** the coarse stand-in the shadow map draws in the piece's place (null on the drawn fallback set) */
  proxy: Mesh | null;
  hit: Mesh;
  pos: Vector3;
  vel: Vector3;
  target: Vector3;
  tilt: Vector2;
  tiltV: Vector2;
  mode: Mode;
  flight: Flight | null;
  /** a mated king going over: it turns about the rim of its base, `t` from 0 to the end of its bounce */
  fall: { t: number; axis: Vector3; pivot: Vector3; base: Vector3 } | null;
  /** a promotion: the pawn sinks into its square, the new piece rises out of it */
  morph: { t: number; to: Kind; swapped: boolean } | null;
}

// ---------------------------------------------------------------- geometry

function turned(kind: Kind): BufferGeometry {
  const prof = PROFILES[kind].map(([r, y]) => new Vector2(r, y));
  const parts: BufferGeometry[] = [new LatheGeometry(prof, 48)];
  if (kind === 'k') {
    const { stem, bar } = KING_CROSS;
    parts.push(new BoxGeometry(stem.w, stem.h, stem.w).translate(0, stem.y, 0));
    parts.push(new BoxGeometry(bar.w, bar.h, stem.w).translate(0, bar.y, 0));
  }
  if (kind === 'r') {
    const m = ROOK_MERLONS;
    for (let i = 0; i < m.n; i++) {
      const a = (i / m.n) * Math.PI * 2 + Math.PI / 4;
      parts.push(new BoxGeometry(m.w, m.h, m.w).rotateY(-a).translate(Math.cos(a) * m.r, m.y + m.h / 2, Math.sin(a) * m.r));
    }
  }
  if (kind === 'q') {
    const c = QUEEN_CROWN;
    for (let i = 0; i < c.n; i++) {
      const a = (i / c.n) * Math.PI * 2;
      parts.push(new SphereGeometry(c.ball, 12, 8).translate(Math.cos(a) * c.r, c.y, Math.sin(a) * c.r));
    }
  }
  if (kind === 'n') {
    const shape = new Shape(knightOutline().map(([x, y]) => new Vector2(x, y)));
    const head = new ExtrudeGeometry(shape, { depth: KNIGHT_HEAD.depth, bevelEnabled: true, bevelThickness: KNIGHT_HEAD.bevel, bevelSize: 0.028, bevelSegments: 3, curveSegments: 4 });
    head.translate(0, 0, -KNIGHT_HEAD.depth / 2);
    parts.push(head);
  }
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  merged.computeBoundingSphere();
  parts.forEach((g) => g.dispose());
  return merged;
}

/** The playing field: maple and walnut veneer, the grain of each square turned across its neighbour's, fine
 *  seams between them, an oiled matte finish that takes the lamp without mirroring it. */
function woodSquares(size: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let seed = 11;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const cell = size / 8;
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const light = (file + rank) % 2 === 1;
      const x = file * cell;
      const y = (7 - rank) * cell;
      g.save();
      g.beginPath();
      g.rect(x, y, cell, cell);
      g.clip();
      // each veneer leaf a shade apart
      const shift = (rnd() - 0.5) * 14;
      g.fillStyle = light ? `hsl(${34 + shift * 0.2} 50% ${66 + shift * 0.25}%)` : `hsl(${23 + shift * 0.3} 44% ${37 + shift * 0.2}%)`;
      g.fillRect(x, y, cell, cell);
      // soft figure in the leaf
      for (let i = 0; i < 5; i++) {
        const cx = x + rnd() * cell;
        const cy = y + rnd() * cell;
        const r = cell * (0.25 + rnd() * 0.5);
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        const tone = light ? `rgba(196,150,92,${0.08 + rnd() * 0.12})` : `rgba(18,8,3,${0.12 + rnd() * 0.18})`;
        grad.addColorStop(0, tone);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(x, y, cell, cell);
      }
      // grain: along the file on light squares, across it on dark ones
      const along = light;
      const lines = light ? 34 : 40;
      for (let l = 0; l < lines; l++) {
        const t = rnd() * cell;
        const dark = rnd() < 0.6;
        g.strokeStyle = light
          ? dark ? `rgba(150,104,56,${0.12 + rnd() * 0.22})` : `rgba(250,226,180,${0.1 + rnd() * 0.18})`
          : dark ? `rgba(14,6,2,${0.18 + rnd() * 0.3})` : `rgba(150,92,52,${0.1 + rnd() * 0.2})`;
        g.lineWidth = cell * (0.004 + rnd() * 0.012);
        g.beginPath();
        const amp = cell * (0.004 + rnd() * 0.02);
        const ph = rnd() * 6.28;
        for (let k = 0; k <= 16; k++) {
          const u = (k / 16) * cell;
          const w = t + Math.sin(k * 0.7 + ph) * amp;
          if (along) (k ? g.lineTo(x + w, y + u) : g.moveTo(x + w, y + u));
          else (k ? g.lineTo(x + u, y + w) : g.moveTo(x + u, y + w));
        }
        g.stroke();
      }
      g.restore();
    }
  }
  g.strokeStyle = 'rgba(30,14,4,0.35)';
  g.lineWidth = Math.max(1, size / 900);
  for (let i = 1; i < 8; i++) {
    g.beginPath();
    g.moveTo(i * cell, 0);
    g.lineTo(i * cell, size);
    g.moveTo(0, i * cell);
    g.lineTo(size, i * cell);
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Long-grained wood: the mahogany of the frame. */
function grainTexture(size: number, base: string, dark: string, light: string, seed0: number, count = 220): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  let seed = seed0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const y = rnd() * size;
    const isDark = rnd() < 0.58;
    g.strokeStyle = (isDark ? dark : light).replace('A', (0.08 + rnd() * 0.26).toFixed(2));
    g.lineWidth = 0.6 + rnd() * (isDark ? 3 : 1.8);
    g.beginPath();
    const amp = 1.5 + rnd() * 7;
    const k = (Math.PI * 2 * (1 + Math.floor(rnd() * 3))) / size;
    const ph = rnd() * Math.PI * 2;
    for (let x = 0; x <= size; x += 8) {
      const yy = y + Math.sin(x * k + ph) * amp;
      if (x === 0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Billiard-room felt for the table: a dark green-grey cloth whose nap only shows close up. */
function felt(size: number): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  let seed = 5;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < size * size; i++) {
    const n = (rnd() - 0.5) * 22;
    img.data[i * 4] = 52 + n;
    img.data[i * 4 + 1] = 82 + n;
    img.data[i * 4 + 2] = 62 + n;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** The file letters and rank numbers inlaid in the frame, turned to face whoever sits at the board. */
function inlay(size: number, orientation: Side, ranks = true): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const F = BOARD.half + BOARD.frame;
  const k = size / (2 * F);
  const at = (x: number, z: number) => [(x + F) * k, (z + F) * k] as const;
  g.fillStyle = 'rgba(236, 214, 170, 0.9)';
  g.font = `600 ${Math.round(k * 0.27)}px -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const edge = BOARD.half + BOARD.frame / 2;
  const turn = orientation === 'w' ? 0 : Math.PI;
  const put = (text: string, x: number, z: number) => {
    const [px, py] = at(x, z);
    g.save();
    g.translate(px, py);
    g.rotate(turn);
    g.fillText(text, 0, 0);
    g.restore();
  };
  for (let i = 0; i < 8; i++) {
    const near = orientation === 'w' ? edge : -edge;
    put(FILES[i], i - 3.5, near);
    const side = orientation === 'w' ? -edge : edge;
    if (ranks) put(String(i + 1), side, 3.5 - i);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Rank numbers inside the squares of the player's left-hand file, for a phone: there the board runs edge to edge
 *  and the frame's own numbers fall off the screen, so they move onto the squares the way chess.com sets them, in
 *  the colour of the other wood. */
function rankLabels(size: number, orientation: Side): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const h = BOARD.half;
  const k = size / (2 * h);
  g.font = `700 ${Math.round(k * 0.22)}px -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, sans-serif`;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  const white = orientation === 'w';
  for (let i = 0; i < 8; i++) {
    // i counts from the far side; the left-hand file is a for white, h for black, and its far square is light
    const rank = white ? 8 - i : i + 1;
    const zc = 4.5 - rank;
    const x = white ? -h + 0.1 : h - 0.1;
    const z = white ? zc - 0.5 + 0.08 : zc + 0.5 - 0.08;
    g.fillStyle = i % 2 === 0 ? 'rgba(96, 56, 28, 0.92)' : 'rgba(240, 222, 186, 0.92)';
    g.save();
    g.translate((x + h) * k, (z + h) * k);
    g.rotate(white ? 0 : Math.PI);
    g.fillText(String(rank), 0, 0);
    g.restore();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A number on a disc, for the order of a demonstrated line. */
function numberTexture(n: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.font = "700 84px -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(n, 64, 70);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A soft round glow: the light under a king in check. */
/** The dark ring where a piece's felt meets the wood: almost black right at the rim of its base, gone a half radius
 *  out. As alpha (the green channel); the base covers the middle. */
function contactTexture(): CanvasTexture {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, s, s);
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  // the base's rim lies at 0.67 of the radius: a near-black crease just outside it, then a soft shade
  for (const [at, a] of [
    [0, 0.85],
    [0.64, 0.85],
    [0.675, 0.66],
    [0.71, 0.34],
    [0.79, 0.16],
    [0.9, 0.06],
    [1, 0],
  ] as const) {
    const v = Math.round(a * 255);
    r.addColorStop(at, `rgb(${v},${v},${v})`);
  }
  g.fillStyle = r;
  g.fillRect(0, 0, s, s);
  return new CanvasTexture(c);
}

function glowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

const square = (s: Sq) => new Vector3(FILES.indexOf(s[0]) - 3.5, BOARD.top, 3.5 - (Number(s[1]) - 1));

/** An arrow lying on the board as a flat outline: straight, or bent like a knight's path. */
function arrowShape(from: Sq, to: Sq): { shape: Shape; path: Vector2[] } {
  const a = square(from);
  const b = square(to);
  const df = b.x - a.x;
  const dr = b.z - a.z;
  const knight = (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
  // in board-plane coordinates (x, z)
  let pts: Vector2[] = [new Vector2(a.x, a.z), new Vector2(b.x, b.z)];
  if (knight) {
    const corner = Math.abs(dr) === 2 ? new Vector2(a.x, b.z) : new Vector2(b.x, a.z);
    pts = [new Vector2(a.x, a.z), corner, new Vector2(b.x, b.z)];
  }
  const W = 0.085; // half the shaft
  const HW = 0.24; // half the head
  const HL = 0.38;
  // start a little off the centre of the first square, end with the tip near the far edge of the last
  const first = pts[1].clone().sub(pts[0]).normalize();
  pts[0].addScaledVector(first, 0.18);
  const lastDir = pts[pts.length - 1].clone().sub(pts[pts.length - 2]).normalize();
  const tip = pts[pts.length - 1].clone().addScaledVector(lastDir, 0.1);
  const neck = tip.clone().addScaledVector(lastDir, -HL);
  const line = [...pts.slice(0, -1), neck];
  const left: Vector2[] = [];
  const right: Vector2[] = [];
  for (let i = 0; i < line.length; i++) {
    const prev = line[Math.max(0, i - 1)];
    const next = line[Math.min(line.length - 1, i + 1)];
    const d0 = i > 0 ? line[i].clone().sub(prev).normalize() : next.clone().sub(line[i]).normalize();
    const d1 = i < line.length - 1 ? next.clone().sub(line[i]).normalize() : d0;
    const n0 = new Vector2(-d0.y, d0.x);
    const n1 = new Vector2(-d1.y, d1.x);
    const n = n0.clone().add(n1).normalize();
    const miter = W / Math.max(0.3, n.dot(n1));
    left.push(line[i].clone().addScaledVector(n, miter));
    right.push(line[i].clone().addScaledVector(n, -miter));
  }
  const ln = new Vector2(-lastDir.y, lastDir.x);
  const outline = [
    ...left,
    neck.clone().addScaledVector(ln, HW),
    tip,
    neck.clone().addScaledVector(ln, -HW),
    ...right.reverse(),
  ];
  return { shape: new Shape(outline), path: [...pts.slice(0, -1), tip] };
}

/** Each vertex's share of the way along the arrow, so it can be drawn on from the tail. */
function along(geo: BufferGeometry, path: Vector2[]) {
  const segs: { a: Vector2; b: Vector2; from: number; len: number }[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const len = path[i].distanceTo(path[i + 1]);
    segs.push({ a: path[i], b: path[i + 1], from: total, len });
    total += len;
  }
  const pos = geo.getAttribute('position');
  const t = new Float32Array(pos.count);
  const p = new Vector2();
  for (let i = 0; i < pos.count; i++) {
    p.set(pos.getX(i), pos.getY(i));
    let best = Infinity;
    let at = 0;
    for (const s of segs) {
      const d = s.b.clone().sub(s.a);
      const u = Math.max(0, Math.min(1, p.clone().sub(s.a).dot(d) / d.lengthSq()));
      const q = s.a.clone().addScaledVector(d, u);
      const dist = q.distanceTo(p);
      if (dist < best) {
        best = dist;
        at = (s.from + u * s.len) / total;
      }
    }
    t[i] = at;
  }
  geo.setAttribute('along', new BufferAttribute(t, 1));
}

// ---------------------------------------------------------------- the view

export function createBoard3d(o: BoardOptions, realism: Realism | null = null): BoardView {
  const canvas = document.createElement('canvas');
  canvas.className = 'board-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  o.host.prepend(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x070908, 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.autoUpdate = false;
  const vsm = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  renderer.shadowMap.type = vsm ? VSMShadowMap : PCFShadowMap;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const scene = new Scene();
  // the felt runs on into the dark of the room: a low camera never finds the table's edge
  scene.fog = new Fog(0x070908, 26, 72);
  const studios = new Map<number, Texture>();
  const studioFor = (dim: number) => {
    let map = studios.get(dim);
    if (!map) {
      const pmrem = new PMREMGenerator(renderer);
      const room = new RoomEnvironment();
      room.traverse((obj) => {
        if ((obj as PointLight).isPointLight) (obj as PointLight).intensity *= dim;
      });
      // a long softbox low behind the board: the band of light the pieces mirror back
      const strip = new Mesh(new PlaneGeometry(16, 1.1), new MeshBasicMaterial({ color: new Color(1, 1, 1).multiplyScalar(2.4) }));
      strip.position.set(0, Math.sin(0.62) * 9, -Math.cos(0.62) * 9);
      strip.lookAt(0, 0, 0);
      room.add(strip);
      map = pmrem.fromScene(room, 0.04).texture;
      strip.geometry.dispose();
      (strip.material as Material).dispose();
      room.dispose();
      pmrem.dispose();
      studios.set(dim, map);
    }
    return map;
  };

  const camera = new PerspectiveCamera(30, 1, 4, 140);
  let orientation: Side = o.orientation;
  let elevation = 0.95;
  let az = 0;
  let el = elevation;
  let angle = 0;
  let portrait = true;
  let cinema = false;
  // the photograph's lens, made the first time the cinema view is asked for
  let lensFx: Focus | null = null;
  /** the still table (still.ts): the picture, and whether it shows the scene as it stands */
  let stillPic: Still | null = null;
  let stillOk = false;
  const preset = () => (cinema ? (portrait ? CINEMA.upright : CINEMA.wide) : portrait ? ANGLES[angle].upright : ANGLES[angle].wide);
  const azimuthFor = () => (orientation === 'w' ? 0 : Math.PI) + preset().az;
  /** a phone straight from the seat or overhead: the playing field edge to edge, the frame's sides off screen */
  const tight = () => portrait && preset().az === 0;
  az = azimuthFor();

  const hemi = new HemisphereLight(0x8fa596, 0x0c140f, STUDIO.hemi);
  scene.add(hemi);
  // one lamp over the board: a pool of warm light on the marble, the table falling into the dark around it
  const key = new SpotLight(0xfff0dc, STUDIO.lamp, 0, 0.5, 0.62, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 8;
  key.shadow.camera.far = 40;
  key.shadow.radius = vsm ? 5 : 2;
  key.shadow.blurSamples = 16;
  key.shadow.bias = vsm ? -0.0006 : -0.0003;
  key.shadow.normalBias = vsm ? 0 : 0.015;
  scene.add(key, key.target);
  /** the lamp hangs where the room has it (high over the player's left shoulder, in most), whichever side they play */
  const placeKey = () => {
    const s = orientation === 'w' ? 1 : -1;
    const at = realism ? world.lamp.at : [-12, 20, 9];
    key.position.set(at[0] * s, at[1], at[2] * s);
  };

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const own = <T extends Material>(m: T) => (materials.push(m), m);

  // reflections come from the room's photograph set on each material (scene.environment would light the table
  // evenly); the room is the one chosen in Pamja (looks.ts) and can change while the board is out
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  let world: WorldDef = WORLDS[realism?.room.world ?? DEFAULT_WORLD];
  let room = realism ? roomLight(renderer, realism.room) : studioFor(STUDIO.room);
  realism?.room.hdr.dispose();
  if (realism) {
    // the room around the table, out of focus as in a photograph of the board
    scene.fog = null;
    scene.background = room;
  }
  let table: Mesh;
  let tableMat: MeshPhysicalMaterial | null = null;
  let tableMaps: Texture[] = [];
  if (realism) {
    // the room's own table, large enough that a low camera finds its far edge and the room beyond
    const top = keep(boxUV(new RoundedBoxGeometry(23, 0.9, 17, 4, 0.32), 7));
    tableMat = own(new MeshPhysicalMaterial({ envMap: room, envMapIntensity: 0.55 }));
    table = new Mesh(top, tableMat);
    table.position.y = -0.45;
  } else {
    const cloth = felt(256);
    cloth.repeat.set(90, 90);
    cloth.anisotropy = aniso;
    textures.push(cloth);
    table = new Mesh(keep(new PlaneGeometry(160, 160).rotateX(-Math.PI / 2)), own(new MeshStandardMaterial({ map: cloth, roughness: 1, envMap: room, envMapIntensity: 0.05 })));
  }
  table.receiveShadow = true;
  scene.add(table);
  /** The table in the room's wood: its colour and roughness photographs, its finish. */
  function dressTable(r: Room) {
    if (!tableMat) return;
    tableMaps.forEach((t) => t.dispose());
    const t = world.table;
    const map = photo(r.table, true, aniso);
    const rough = photo(r.tableR, false, aniso);
    // the table's UVs are cut at 7 squares to the photograph; each wood has its own grain size
    const k = 7 / t.unit;
    map.repeat.set(k, k);
    rough.repeat.set(k, k);
    tableMaps = [map, rough];
    tableMat.map = map;
    tableMat.roughnessMap = rough;
    tableMat.bumpMap = rough;
    tableMat.roughness = t.rough;
    tableMat.bumpScale = t.bump;
    tableMat.clearcoat = t.coat;
    tableMat.clearcoatRoughness = t.coatRough;
    tableMat.color.set(t.tint);
    tableMat.needsUpdate = true;
  }
  if (realism) dressTable(realism.room);

  // ---------------------------------------------------------------- the board
  // A folding chess box, as the wooden ones are made: two hollow halves hinged under the middle (between the 4th and
  // 5th ranks). Each half is a top plate carrying its four ranks of squares, four walls under it and a velvet lining
  // inside, where the pieces travel. In play the box lies open and turned squares-up, the seam a fine line across the
  // frame; on the first visit of the day it lies shut on the table (see "the case" below).
  const board = new Group();
  scene.add(board);
  const F = BOARD.half + BOARD.frame;
  const frameH = BOARD.top - BOARD.frameDrop;
  /** the two halves: [0] the near one in play (ranks 1-4), [1] the far one (ranks 5-8) */
  const halves = [new Group(), new Group()];
  board.add(...halves);
  /** add a part of the board to its half; positions are given as the box lies open in play */
  const mount = (m: Mesh, far: boolean) => {
    halves[far ? 1 : 0].add(m);
    return m;
  };
  /** the top plate's thickness and the walls' */
  const PLATE = 0.13;
  const WALL = 0.22;
  /** a flat plane over the board cut at the hinge: one leaf's half, with that half of the texture */
  const halfPlane = (w: number, d: number, far: boolean) => {
    const g = new PlaneGeometry(w, d / 2).rotateX(-Math.PI / 2).translate(0, 0, far ? -d / 4 : d / 4);
    const uv = g.getAttribute('uv') as BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, (far ? 0.5 : 0) + uv.getY(i) * 0.5);
    return keep(g);
  };
  const grain = grainTexture(512, '#4b2213', 'rgba(22,6,1,A)', 'rgba(150,72,40,A)', 23);
  textures.push(grain);
  let wood: MeshPhysicalMaterial;
  if (realism) {
    const rose = photo(realism.rosewood, true, aniso);
    const roseR = photo(realism.rosewoodR, false, aniso);
    textures.push(rose, roseR);
    // rosewood under piano lacquer (Luca, 2026-10-15: "the board make it more expensive"): the figure deep in the
    // wood, a mirror coat over it that shows the room and never the lamp
    wood = own(
      noGlare(
        new MeshPhysicalMaterial({
          map: rose,
          color: 0xa88478,
          roughnessMap: roseR,
          roughness: 0.5,
          clearcoat: 1,
          clearcoatRoughness: 0.07,
          specularIntensity: 0.5,
          envMap: room,
          envMapIntensity: 0.42,
        }),
      ),
    );
  } else wood = own(new MeshPhysicalMaterial({ map: grain, roughness: 0.78, specularIntensity: 0.15, envMap: room, envMapIntensity: 0.7 }));
  /** wood grain on a box-like part: real mahogany wants box-projected UVs at its own scale */
  const woody = <T extends BufferGeometry>(g: T) => (realism ? boxUV(g, 5.5) : g);
  // inside each half: velvet, wine red as in a good chess case
  let lining: Material;
  if (realism) {
    const nap = photo(realism.velvetN, false, aniso);
    const cloth = photo(realism.velvet, true, aniso);
    nap.repeat.set(5, 3);
    cloth.repeat.set(5, 3);
    textures.push(nap, cloth);
    lining = own(
      new MeshPhysicalMaterial({
        map: cloth,
        color: 0xb04050,
        roughness: 0.95,
        sheen: 1,
        sheenRoughness: 0.55,
        sheenColor: new Color(0xd06070),
        normalMap: nap,
        normalScale: new Vector2(0.5, 0.5),
        envMap: room,
        envMapIntensity: 0.2,
      }),
    );
  } else lining = own(new MeshStandardMaterial({ color: 0x5a1520, roughness: 1 }));
  const wallH = frameH - PLATE + 0.01;
  for (const far of [false, true]) {
    const zc = far ? -F / 2 : F / 2;
    const sgn = far ? -1 : 1;
    // the top plate, its rounded edge the line where the lid would meet its walls
    const plate = new Mesh(keep(woody(new RoundedBoxGeometry(2 * F, PLATE, F, 4, 0.045))), wood);
    plate.position.set(0, frameH - PLATE / 2, zc);
    plate.castShadow = plate.receiveShadow = true;
    mount(plate, far);
    // four walls under it: the outer edge, the hinge edge and the two sides
    const walls: [number, number, number, number][] = [
      [2 * F, F - WALL / 2, 0, WALL],
      [2 * F, WALL / 2, 0, WALL],
      [WALL, F / 2, F - WALL / 2, F - 2 * WALL + 0.02],
      [WALL, F / 2, -(F - WALL / 2), F - 2 * WALL + 0.02],
    ];
    for (const [w, z, x, d] of walls) {
      const wall = new Mesh(keep(woody(new RoundedBoxGeometry(w, wallH, d, 3, 0.03))), wood);
      wall.position.set(x, wallH / 2, sgn * z);
      wall.castShadow = wall.receiveShadow = true;
      mount(wall, far);
    }
    // the velvet lining on the inside of the plate
    const felt = new Mesh(keep(new PlaneGeometry(2 * F - 2 * WALL, F - 2 * WALL).rotateX(Math.PI / 2)), lining);
    felt.position.set(0, frameH - PLATE - 0.002, zc);
    mount(felt, far);
  }
  // boxwood stringing let into the wood: one line near the outer edge; the lines that run across the hinge are cut
  // in two. Round the squares, on the luxury board, a rope inlay instead (below)
  const brass = own(new MeshStandardMaterial({ color: 0xe9d3a4, roughness: 0.85, envMap: room, envMapIntensity: 0.5 }));
  for (const [d, w] of (realism
    ? [[F - 0.085, 0.022]]
    : [
        [BOARD.half + 0.075, 0.032],
        [F - 0.085, 0.022],
      ]) as [number, number][]) {
    const len = 2 * d + w;
    for (const z of [d, -d]) {
      const bar = new Mesh(keep(new BoxGeometry(len, 0.012, w)), brass);
      bar.position.set(0, frameH + 0.001, z);
      bar.receiveShadow = true;
      mount(bar, z < 0);
    }
    for (const x of [d, -d])
      for (const far of [false, true]) {
        const bar = new Mesh(keep(new BoxGeometry(w, 0.012, len / 2 - 0.03)), brass);
        bar.position.set(x, frameH + 0.001, (far ? -1 : 1) * (len / 4 + 0.015));
        bar.receiveShadow = true;
        mount(bar, far);
      }
  }
  // the rope inlay of a fine board: short slanting leaves of maple and rosewood between two dark lines, all round the
  // squares under the same lacquer as the frame (each strip's UVs run one tile per ROPE squares along it)
  if (realism) {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 64;
    const tg = tile.getContext('2d')!;
    tg.fillStyle = '#5a2414';
    tg.fillRect(0, 0, 256, 64);
    for (let i = -2; i < 10; i++) {
      tg.fillStyle = i % 2 ? '#e8c890' : '#6e2c18';
      tg.beginPath();
      tg.moveTo(i * 32, 54);
      tg.lineTo(i * 32 + 32, 54);
      tg.lineTo(i * 32 + 56, 10);
      tg.lineTo(i * 32 + 24, 10);
      tg.closePath();
      tg.fill();
    }
    tg.fillStyle = '#1e0c06';
    tg.fillRect(0, 0, 256, 10);
    tg.fillRect(0, 54, 256, 10);
    tg.fillStyle = '#e2c48e';
    tg.fillRect(0, 4, 256, 3);
    tg.fillRect(0, 57, 256, 3);
    const ropeTex = new CanvasTexture(tile);
    ropeTex.colorSpace = SRGBColorSpace;
    ropeTex.wrapS = RepeatWrapping;
    ropeTex.anisotropy = aniso;
    textures.push(ropeTex);
    const ropeMat = own(noGlare(new MeshPhysicalMaterial({ map: ropeTex, roughness: 0.55, clearcoat: 1, clearcoatRoughness: 0.08, envMap: room, envMapIntensity: 0.4 })));
    const W2 = 0.075;
    const d = BOARD.half + 0.012 + W2 / 2;
    const ROPE = 0.3;
    /** a strip of rope along x, len long, its pattern running along it */
    const strip = (len: number) => {
      const g = new BoxGeometry(len, 0.01, W2);
      const uv = g.getAttribute('uv') as BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / ROPE));
      return keep(g);
    };
    const len = 2 * d + W2;
    for (const z of [d, -d]) {
      const m = new Mesh(strip(len), ropeMat);
      m.position.set(0, frameH + 0.002, z);
      m.receiveShadow = true;
      mount(m, z < 0);
    }
    for (const x of [d, -d])
      for (const far of [false, true]) {
        const l = len / 2 - W2 - 0.01;
        const m = new Mesh(strip(l), ropeMat);
        m.rotation.y = Math.PI / 2;
        m.position.set(x, frameH + 0.002, (far ? -1 : 1) * (W2 / 2 + 0.005 + l / 2));
        m.receiveShadow = true;
        mount(m, far);
      }
  }
  // the case's clasp: a brass plate low on the outer wall of each half; shut, the two meet at the front
  const claspMat = own(new MeshPhysicalMaterial({ color: 0xc9a24a, metalness: 1, roughness: 0.3, envMap: room, envMapIntensity: 0.9 }));
  const claspGeo = keep(new BoxGeometry(0.46, 0.12, 0.035));
  for (const far of [false, true]) {
    const clasp = new Mesh(claspGeo, claspMat);
    clasp.position.set(0, 0.11, far ? -F - 0.017 : F + 0.017);
    clasp.castShadow = true;
    mount(clasp, far);
  }
  // brass corner caps on the four outer corners of the case: an angle over the top edge and a strip down the corner
  if (realism) {
    const capTop = keep(new BoxGeometry(0.4, 0.012, 0.075));
    const capSide = keep(new BoxGeometry(0.075, frameH - 0.02, 0.075));
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const far = sz < 0;
        const a = new Mesh(capTop, claspMat);
        a.position.set(sx * (F - 0.2 + 0.004), frameH + 0.004, sz * (F - 0.0375 + 0.004));
        const b = new Mesh(capTop, claspMat);
        b.rotation.y = Math.PI / 2;
        b.position.set(sx * (F - 0.0375 + 0.004), frameH + 0.004, sz * (F - 0.2 + 0.004));
        const c = new Mesh(capSide, claspMat);
        c.position.set(sx * (F - 0.0375 + 0.008), (frameH - 0.02) / 2 + 0.01, sz * (F - 0.0375 + 0.008));
        for (const m of [a, b, c]) {
          m.castShadow = true;
          mount(m, far);
        }
      }
  }
  // the bed the squares are laid on: dark, so no pale line shows between the squares and the frame
  const slabMat = own(new MeshStandardMaterial({ color: 0x1c120b, roughness: 0.8 }));
  for (const far of [false, true]) {
    const slab = new Mesh(keep(new BoxGeometry(2 * BOARD.half, 0.06, BOARD.half)), slabMat);
    slab.position.set(0, BOARD.top - 0.031, far ? -BOARD.half / 2 : BOARD.half / 2);
    slab.receiveShadow = true;
    mount(slab, far);
  }
  let fieldMat: MeshPhysicalMaterial;
  if (realism) {
    const { map, rough } = squareMaps(realism, Math.min(2048, renderer.capabilities.maxTextureSize));
    map.anisotropy = rough.anisotropy = aniso;
    textures.push(map, rough);
    // an inlaid board under a satin finish: the grain shows in the sheen, the lamp does not glare off it
    // maple and rosewood under the same lacquer: the room and the pieces show in it as in a polished board; the lamp
    // does not (noGlare), so no square is ever washed out
    fieldMat = own(
      noGlare(
        new MeshPhysicalMaterial({
          map,
          roughnessMap: rough,
          roughness: 0.8,
          bumpMap: rough,
          bumpScale: 0.12,
          specularIntensity: 0.35,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          envMap: room,
          envMapIntensity: 0.4,
        }),
      ),
    );
  } else {
    const fieldMap = woodSquares(Math.min(2048, renderer.capabilities.maxTextureSize));
    fieldMap.anisotropy = aniso;
    textures.push(fieldMap);
    fieldMat = own(new MeshPhysicalMaterial({ map: fieldMap, roughness: 0.88, specularIntensity: 0.08, envMap: room, envMapIntensity: 0.55 }));
  }
  for (const far of [false, true]) {
    const surface = new Mesh(halfPlane(2 * BOARD.half, 2 * BOARD.half, far), fieldMat);
    surface.position.y = BOARD.top + 0.0005;
    surface.receiveShadow = true;
    mount(surface, far);
  }
  // the coordinates inlaid in the frame top
  const inlayMat = own(new MeshBasicMaterial({ transparent: true, depthWrite: false }));
  inlayMat.toneMapped = false;
  for (const far of [false, true]) {
    const inlayPlane = new Mesh(halfPlane(2 * F, 2 * F, far), inlayMat);
    inlayPlane.position.y = frameH + 0.008;
    inlayPlane.renderOrder = 1;
    mount(inlayPlane, far);
  }
  // on a phone the rank numbers move onto the edge squares (the frame's sides are off screen there)
  const ranksMat = own(new MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  ranksMat.toneMapped = false;
  const rankHalves: Mesh[] = [];
  for (const far of [false, true]) {
    const half = new Mesh(halfPlane(2 * BOARD.half, 2 * BOARD.half, far), ranksMat);
    half.position.y = BOARD.top + 0.002;
    half.renderOrder = 1;
    rankHalves.push(mount(half, far));
  }
  const ranksPlane = {
    get visible() {
      return rankHalves[0].visible;
    },
    set visible(v: boolean) {
      rankHalves.forEach((m) => (m.visible = v));
    },
  };
  ranksPlane.visible = false;
  let ranksMap: CanvasTexture | null = null;
  let inlayMap: CanvasTexture | null = null;
  const drawInlay = () => {
    inlayMap?.dispose();
    // edge to edge on a phone the numbers live on the squares, and the frame's would peek in at the screen edge
    inlayMap = inlay(1024, orientation, !ranksPlane.visible);
    inlayMat.map = inlayMap;
    ranksMap?.dispose();
    ranksMap = rankLabels(1024, orientation);
    ranksMat.map = ranksMap;
    ranksMat.needsUpdate = true;
    inlayMat.needsUpdate = true;
  };
  // the face may still be loading: draw now, and again once it is in
  drawInlay();
  document.fonts?.ready.then(() => {
    drawInlay();
    dirty = true;
  });

  // ---------------------------------------------------------------- on the table: what the room keeps there
  // across the board from the player, so it shows beyond the far edge: a clock and a cup, books and a lamp, a mug and
  // a notebook... each room its own (looks.ts), made again when the room changes
  const props = new Group();
  scene.add(props);
  let propParts: { geos: BufferGeometry[]; mats: Material[]; texs: Texture[] } = { geos: [], mats: [], texs: [] };
  const makeProp = (id: PropId, kit: Kit): Group => {
    switch (id) {
      case 'clock':
        return chessClock(kit);
      case 'cup':
        return coffeeCup(kit);
      case 'books':
        return books(kit);
      case 'lamp':
        return bankersLamp(kit);
      case 'mug':
        return mug(kit, world.id === 'night' ? 0x1f2b3c : 0xe6e2da);
      case 'notebook':
        return notebook(kit, world.id === 'night' ? 0x1a1a1a : 0xa07a4e);
      case 'tumbler':
        return tumbler(kit);
      case 'deskLamp':
        return deskLamp(kit);
      case 'phone':
        return phone(kit);
      case 'candle':
        return candle(kit);
    }
  };
  function buildProps() {
    props.clear();
    propParts.geos.forEach((g) => g.dispose());
    propParts.mats.forEach((m) => m.dispose());
    propParts.texs.forEach((t) => t.dispose());
    const parts: typeof propParts = { geos: [], mats: [], texs: [] };
    propParts = parts;
    if (!realism) return;
    const kit: Kit = { wood, env: room, woody, keep: (g) => (parts.geos.push(g), g), own: (m) => (parts.mats.push(m), m), textures: parts.texs };
    for (const [id, x, z, turn] of world.props) {
      const p = makeProp(id, kit);
      p.position.set(x, 0, z);
      p.rotation.y = turn;
      props.add(p);
    }
  }
  /** the props stand across from whoever plays, on the far side of the table */
  const placeProps = () => {
    props.rotation.y = orientation === 'w' ? 0 : Math.PI;
  };
  placeProps();

  // ---------------------------------------------------------------- the pieces
  const shapes = new Map<Kind, BufferGeometry>();
  const shapeOf = (k: Kind) => {
    let g = shapes.get(k);
    if (!g) shapes.set(k, (g = keep(realism ? realism.pieces[k].geometry : turned(k))));
    return g;
  };
  /** the widest radius and the height of a piece as drawn here */
  const girthOf = (k: Kind) => (realism ? realism.pieces[k].girth : GIRTH[k]);
  const heightOf = (k: Kind) => (realism ? realism.pieces[k].height : HEIGHT[k]);
  // the set chosen in Pamja: every piece its own material (its own figure of grain), made again when the set changes
  let pieceSet: PieceSetId = chosenSet();
  let turnedWood: ((side: Side) => Material) | null = null;
  if (realism) {
    const maple = photo(realism.maple, true, aniso);
    const walnut = photo(realism.walnut, true, aniso);
    textures.push(maple, walnut);
    let n = 0;
    turnedWood = (side) => lit(pieceMaterial(pieceSet, side, { maple, walnut, env: room, grain: new Vector2(((n * 0.618) % 1) * 3, ((n * 0.382) % 1) * 3), shade: ((n++ * 0.7548) % 1) * 2 - 1 }));
  }
  // boxwood: a fine pale grain under a thin lacquer (the lathe's UVs run the grain up the piece)
  const boxwood = grainTexture(256, '#f7ecd4', 'rgba(170,128,80,A)', 'rgba(255,248,230,A)', 41, 60);
  boxwood.rotation = Math.PI / 2;
  boxwood.repeat.set(3, 1);
  textures.push(boxwood);
  const ivory = own(new MeshPhysicalMaterial({ map: boxwood, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.18, envMap: room, envMapIntensity: 0.85 }));
  const ebony = own(new MeshPhysicalMaterial({ color: 0x121214, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.05, envMap: room, envMapIntensity: 1.25 }));
  const hitMat = own(new MeshBasicMaterial({ visible: false }));
  const hitGeo = new Map<Kind, BufferGeometry>();
  const hitOf = (k: Kind) => {
    let g = hitGeo.get(k);
    if (!g) hitGeo.set(k, (g = keep(new CylinderGeometry(0.44, 0.44, heightOf(k) + 0.12, 12).translate(0, (heightOf(k) + 0.12) / 2, 0))));
    return g;
  };

  const bodies: Body[] = [];
  // a draw skipped in one pass: the shadow stand-ins in the picture, the fine pieces in the shadow map
  const proxyMat = own(new MeshBasicMaterial());
  const hideDraw = (...args: unknown[]) => {
    const g = args.find((a) => (a as BufferGeometry)?.isBufferGeometry) as BufferGeometry;
    // a range that starts past its end: three.js returns before the draw call
    g.drawRange.start = Infinity;
  };
  const showDraw = (...args: unknown[]) => {
    const g = args.find((a) => (a as BufferGeometry)?.isBufferGeometry) as BufferGeometry;
    g.drawRange.start = 0;
  };
  const bySq = new Map<Sq, Body>();
  const upright = new Quaternion();
  const lying = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  // knights turn their profile to the player, looking a little up the board, so the head reads from above
  const knightYaw = (side: Side) => (side === 'w' ? -0.5 : Math.PI - 0.5);

  function setShape(b: Body, kind: Kind) {
    b.kind = kind;
    b.mesh.geometry = shapeOf(kind);
    if (b.proxy && realism) b.proxy.geometry = realism.shadows[kind];
    const refl = reflections.get(b);
    if (refl && realism) refl.geometry = realism.shadows[kind];
    b.hit.geometry = hitOf(kind);
    b.mesh.rotation.y = kind === 'n' ? knightYaw(b.side) : 0;
  }

  // contact shadows: a soft dark ring on the wood under every standing piece (the shadow map is too soft to draw
  // the line where the felt meets the board, and without it a piece floats)
  const contactTex = contactTexture();
  textures.push(contactTex);
  const contactGeo = keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const contacts = new Map<Body, Mesh>();
  // one ring always drawn (out of sight under the table, fully clear), so its program is compiled for the screen and
  // for the lens's target alike before any piece needs it; otherwise it compiles the moment the first piece stands
  const keeper = new Mesh(contactGeo, own(new MeshBasicMaterial({ color: 0x0a0604, alphaMap: contactTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity: 0 })));
  keeper.position.set(0, -2, 0);
  keeper.scale.setScalar(0.01);
  board.add(keeper);
  /** where a piece at (x, z) stands: on the squares when the box lies open, else on the table */
  const groundAt = (x: number, z: number) => (halves[0].position.y === 0 && halves[0].quaternion.w === 1 && Math.abs(x) <= F && Math.abs(z) <= F ? BOARD.top : 0);
  // ---------------------------------------------------------------- the pieces in the lacquer
  // A polished board shows the pieces standing in it. Each piece's coarse stand-in is drawn mirrored under the board;
  // the fragment works out where its view ray crosses the lacquer and takes that point's depth, so the board itself
  // never hides the reflection and anything standing on the board does. Strong where the view grazes the board (the
  // home screen's low view), faint from the seat, gone a piece's height above the surface.
  const LACQUER = BOARD.top + 0.0005;
  const mirror = new Matrix4().makeTranslation(0, 2 * LACQUER, 0).multiply(new Matrix4().makeScale(1, -1, 1));
  const viewProj = new Matrix4();
  const REFLECT: Record<PieceSetId, Record<Side, [number, number, number]>> = {
    wood: { w: [0.62, 0.48, 0.3], b: [0.06, 0.045, 0.035] },
    lacquer: { w: [0.7, 0.64, 0.52], b: [0.16, 0.012, 0.01] },
    glass: { w: [0.55, 0.6, 0.6], b: [0.35, 0.03, 0.05] },
    metal: { w: [0.75, 0.75, 0.78], b: [0.8, 0.58, 0.25] },
  };
  const reflMat = () =>
    own(
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color() }, uTop: { value: LACQUER }, uEdge: { value: BOARD.half }, uViewProj: { value: viewProj } },
        vertexShader: `
          varying vec3 vWorld;
          varying vec3 vNormal;
          void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            vNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uTop;
          uniform float uEdge;
          uniform mat4 uViewProj;
          varying vec3 vWorld;
          varying vec3 vNormal;
          void main() {
            // where the view ray to this mirrored point crosses the lacquer: only the squares reflect
            vec3 ray = vWorld - cameraPosition;
            vec3 q = cameraPosition + ray * ((uTop - cameraPosition.y) / ray.y);
            if (abs(q.x) > uEdge || abs(q.z) > uEdge) discard;
            float fade = exp(-(uTop - vWorld.y) * 1.8);
            float fres = mix(0.1, 0.6, pow(1.0 - abs(normalize(ray).y), 3.0));
            float shade = 0.55 + 0.45 * clamp(0.4 - vNormal.y * 0.6, 0.0, 1.0);
            gl_FragColor = vec4(uColor * shade, fres * fade);
            vec4 clip = uViewProj * vec4(q, 1.0);
            gl_FragDepth = clip.z / clip.w * 0.5 + 0.5 - 0.00002;
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
  const reflMats: Record<Side, ShaderMaterial> | null = realism ? { w: reflMat(), b: reflMat() } : null;
  const tintReflections = () => {
    if (!reflMats) return;
    for (const side of ['w', 'b'] as Side[]) (reflMats[side].uniforms.uColor.value as Color).setRGB(...REFLECT[pieceSet][side]);
  };
  const reflections = new Map<Body, Mesh>();

  function ground() {
    if (reflMats) {
      camera.updateMatrixWorld();
      viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    }
    for (const [b, disc] of contacts) {
      const g = b.group;
      if (!g.visible) {
        disc.visible = false;
        continue;
      }
      const q = g.quaternion;
      // only an upright piece rests on its felt; one lying over, falling or turning keeps the shadow map's shadow
      const up = 1 - 2 * (q.x * q.x + q.z * q.z);
      const floor = groundAt(g.position.x, g.position.z);
      const h = Math.max(0, g.position.y - floor);
      const k = Math.max(0, Math.min(1, (up - 0.9) / 0.09)) * Math.max(0, 1 - h / 0.45);
      disc.visible = k > 0.01;
      const refl = reflections.get(b);
      if (refl) {
        // in the lacquer only while the box lies open and the piece is over the board
        refl.visible = disc.visible && floor === BOARD.top;
        if (refl.visible) {
          g.updateMatrixWorld(true);
          refl.matrix.multiplyMatrices(mirror, b.mesh.matrixWorld);
          refl.matrixWorldNeedsUpdate = true;
        }
      }
      if (!disc.visible) continue;
      // lifted, the ring spreads and fades, as a shadow does
      const d = girthOf(b.kind) * 3 * (1 + h * 1.2);
      disc.scale.set(d, 1, d);
      disc.position.set(g.position.x, floor + 0.003, g.position.z);
      (disc.material as MeshBasicMaterial).opacity = k;
    }
  }

  function makeBody(side: Side, kind: Kind): Body {
    const group = new Group();
    const mesh = new Mesh(shapeOf(kind), turnedWood ? turnedWood(side) : side === 'w' ? ivory : ebony);
    mesh.castShadow = mesh.receiveShadow = true;
    // the fine piece is drawn for the eye, a coarse stand-in for the shadow map (a soft shadow cannot show the
    // difference, and the frame is spared drawing every piece twice in full)
    let proxy: Mesh | null = null;
    if (realism) {
      proxy = new Mesh(realism.shadows[kind], proxyMat);
      proxy.castShadow = true;
      proxy.receiveShadow = false;
      proxy.onBeforeRender = hideDraw;
      proxy.onAfterRender = showDraw;
      mesh.castShadow = false;
      // soft (VSM) shadows draw every receiver into the map as well: not this one
      mesh.onBeforeShadow = hideDraw;
      mesh.onAfterShadow = showDraw;
      mesh.add(proxy);
    }
    const hit = new Mesh(hitOf(kind), hitMat);
    group.add(mesh, hit);
    board.add(group);
    const b: Body = {
      side,
      kind,
      sq: null,
      group,
      mesh,
      proxy,
      hit,
      pos: new Vector3(),
      vel: new Vector3(),
      target: new Vector3(),
      tilt: new Vector2(),
      tiltV: new Vector2(),
      mode: 'off',
      flight: null,
      fall: null,
      morph: null,
    };
    setShape(b, kind);
    bodies.push(b);
    const disc = new Mesh(
      contactGeo,
      own(new MeshBasicMaterial({ color: 0x0a0604, alphaMap: contactTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })),
    );
    disc.visible = false;
    board.add(disc);
    contacts.set(b, disc);
    if (reflMats && realism) {
      const refl = new Mesh(realism.shadows[kind], reflMats[side]);
      refl.matrixAutoUpdate = false;
      refl.visible = false;
      refl.frustumCulled = false;
      scene.add(refl);
      reflections.set(b, refl);
    }
    return b;
  }

  /** A body that is off the board, ready to come back as this piece. */
  function spare(side: Side, kind: Kind): Body {
    // the same piece lying beside the board comes back first, then any spare body of that colour
    const free = (x: Body) => x.mode === 'off' && x.side === side && !x.flight;
    const b = bodies.find((x) => free(x) && x.kind === kind && x.group.visible) ?? bodies.find(free) ?? makeBody(side, kind);
    if (b.kind !== kind) setShape(b, kind);
    return b;
  }

  /** Where taken pieces leave the board: onto the open felt on the player's right (the broadcast graphics hold the
   *  left on a wide screen), white's nearer the player, black's further away. */
  const outside = (side: Side, i: number, kind: Kind = 'q') => {
    const toward = orientation === 'w' ? 1 : -1;
    const near = side === 'w' ? 1 : -1;
    const row = Math.floor(i / 4);
    // seen straight from the seat on an upright phone, the felt beside the board is out of frame: lay them well
    // clear of the edge rather than cut in half by it (the score bug counts them)
    const gap = portrait && preset().az === 0 ? 4.2 : 1.05;
    return new Vector3((F + gap + row * 0.95) * toward, girthOf(kind), toward * near * (0.9 + (i % 4) * 0.85));
  };
  /** Lay the taken pieces again after the framing changes (a turned phone, another camera angle). */
  const relay = () => {
    for (const side of ['w', 'b'] as Side[]) {
      bodies.filter((x) => x.mode === 'off' && x.group.visible && x.side === side && !x.flight).forEach((b, i) => lie(b, outside(side, i, b.kind)));
    }
  };
  /** taken pieces already lying beside the board, per side */
  const lyingCount = (side: Side) => bodies.filter((x) => x.mode === 'off' && x.group.visible && x.side === side && !x.flight).length;

  // ---------------------------------------------------------------- marks
  const accent = new Color();
  const markMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  markMat.toneMapped = false;
  // the last move in the warm yellow of a chess highlight; the square under the pointer in the tint
  const lastMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.26, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  lastMat.toneMapped = false;
  const overMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  overMat.toneMapped = false;
  const ringMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }));
  ringMat.toneMapped = false;
  // a piece in danger: a ring in the status red round its foot, over a faint red wash of its square
  const dangerMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  dangerMat.toneMapped = false;
  const dangerWash = own(new MeshBasicMaterial({ transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  dangerWash.toneMapped = false;
  const glowMap = glowTexture();
  textures.push(glowMap);
  const glowMat = own(new MeshBasicMaterial({ map: glowMap, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  glowMat.toneMapped = false;

  const dotGeo = keep(new CircleGeometry(0.13, 32).rotateX(-Math.PI / 2));
  const takeGeo = keep(new RingGeometry(0.4, 0.47, 48).rotateX(-Math.PI / 2));
  const tileGeo = keep(new PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  const frameShape = new Shape([new Vector2(-0.48, -0.48), new Vector2(0.48, -0.48), new Vector2(0.48, 0.48), new Vector2(-0.48, 0.48)]);
  const hole = new Shape([new Vector2(-0.4, -0.4), new Vector2(-0.4, 0.4), new Vector2(0.4, 0.4), new Vector2(0.4, -0.4)]);
  frameShape.holes.push(hole);
  const outlineGeo = keep(new ShapeGeometry(frameShape).rotateX(-Math.PI / 2));
  const glowGeo = keep(new PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2));

  const dots: Mesh[] = [];
  for (let i = 0; i < 28; i++) {
    const m = new Mesh(dotGeo, markMat);
    m.visible = false;
    m.renderOrder = 3;
    board.add(m);
    dots.push(m);
  }
  const lastTiles = [0, 1].map(() => {
    const m = new Mesh(tileGeo, lastMat);
    m.visible = false;
    m.renderOrder = 1;
    board.add(m);
    return m;
  });
  const overTile = new Mesh(tileGeo, overMat);
  overTile.visible = false;
  board.add(overTile);
  const checkGlow = new Mesh(glowGeo, glowMat);
  checkGlow.visible = false;
  checkGlow.renderOrder = 1;
  board.add(checkGlow);
  const focusRings: Mesh[] = [];
  const dangerMarks: Mesh[] = [];
  const cursorRing = new Mesh(outlineGeo, ringMat);
  cursorRing.visible = false;
  cursorRing.renderOrder = 4;
  board.add(cursorRing);

  // arrows: flat outlines drawn on from the tail by a share-of-length cut
  interface ArrowMesh {
    mesh: Mesh;
    mat: ShaderMaterial;
    badge: Group | null;
    key: string;
  }
  let arrows: ArrowMesh[] = [];
  const numbers = new Map<string, CanvasTexture>();
  const badgeGeo = keep(new CircleGeometry(0.2, 32).rotateX(-Math.PI / 2));
  const labelGeo = keep(new PlaneGeometry(0.36, 0.36).rotateX(-Math.PI / 2));
  const arrowVert = `attribute float along; varying float vAlong; void main(){ vAlong = along; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const arrowFrag = `uniform vec3 uColor; uniform float uOpacity; uniform float uProgress; varying float vAlong; void main(){ if (vAlong > uProgress) discard; gl_FragColor = vec4(uColor, uOpacity); }`;

  function clearArrows() {
    for (const a of arrows) {
      board.remove(a.mesh);
      a.mesh.geometry.dispose();
      a.mat.dispose();
      if (a.badge) {
        board.remove(a.badge);
        a.badge.traverse((c) => (c as Mesh).isMesh && ((c as Mesh).material as Material).dispose());
      }
    }
    arrows = [];
  }

  function drawArrows(list: Arrow[]) {
    const keyOf = (a: Arrow) => `${a.from}${a.to}${a.label ?? ''}${a.tone ?? ''}`;
    if (list.map(keyOf).join('|') === arrows.map((a) => a.key).join('|')) return;
    clearArrows();
    list.forEach((a, i) => {
      const { shape, path } = arrowShape(a.from, a.to);
      const geo = new ShapeGeometry(shape);
      along(geo, path);
      // the shape is drawn in (x, z); lay it flat on the board
      geo.rotateX(Math.PI / 2);
      const quiet = a.tone === 'quiet';
      const mat = new ShaderMaterial({
        uniforms: { uColor: { value: accent.clone() }, uOpacity: { value: quiet ? 0.74 : 0.92 }, uProgress: { value: motionOn ? 0 : 1 } },
        vertexShader: arrowVert,
        fragmentShader: arrowFrag,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: DoubleSide,
      });
      mat.toneMapped = false;
      const mesh = new Mesh(geo, mat);
      mesh.position.y = BOARD.top + 0.004 + i * 0.0005;
      mesh.renderOrder = 50 + i;
      board.add(mesh);
      let badge: Group | null = null;
      if (a.label) {
        let tex = numbers.get(a.label);
        if (!tex) numbers.set(a.label, (tex = numberTexture(a.label)));
        const discMat = new MeshBasicMaterial({ color: accent.clone(), transparent: true, depthWrite: false, depthTest: false });
        discMat.toneMapped = false;
        const textMat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
        textMat.toneMapped = false;
        badge = new Group();
        const disc = new Mesh(badgeGeo, discMat);
        disc.renderOrder = 70 + i;
        const text = new Mesh(labelGeo, textMat);
        text.position.y = 0.001;
        text.renderOrder = 80 + i;
        badge.add(disc, text);
        const tail = path[0];
        badge.position.set(tail.x, BOARD.top + 0.006, tail.y);
        if (orientation === 'b') badge.rotation.y = Math.PI;
        badge.visible = true;
        board.add(badge);
      }
      arrows.push({ mesh, mat, badge, key: keyOf(a) });
    });
    arrowClock = 0;
    dirty = true;
  }
  let arrowClock = 0;

  let marks: Marks = {};
  function applyMarks() {
    const last = marks.last;
    lastTiles.forEach((m, i) => {
      m.visible = !!last;
      if (last) m.position.copy(square(last[i])).setY(BOARD.top + 0.002);
    });
    checkGlow.visible = !!marks.check;
    if (marks.check) checkGlow.position.copy(square(marks.check)).setY(BOARD.top + 0.003);
    focusRings.forEach((r) => board.remove(r));
    focusRings.length = 0;
    for (const s of marks.focus ?? []) {
      const r = new Mesh(outlineGeo, ringMat);
      r.position.copy(square(s)).setY(BOARD.top + 0.005);
      r.renderOrder = 4;
      board.add(r);
      focusRings.push(r);
    }
    dangerMarks.forEach((m) => board.remove(m));
    dangerMarks.length = 0;
    for (const s of marks.danger ?? []) {
      const wash = new Mesh(tileGeo, dangerWash);
      wash.position.copy(square(s)).setY(BOARD.top + 0.0025);
      wash.renderOrder = 1;
      const ring = new Mesh(takeGeo, dangerMat);
      ring.position.copy(square(s)).setY(BOARD.top + 0.0045);
      ring.renderOrder = 3;
      board.add(wash, ring);
      dangerMarks.push(wash, ring);
    }
    drawArrows(marks.arrows ?? []);
    dirty = true;
  }

  // ---------------------------------------------------------------- state
  let motionOn = o.motion();
  let interactive = true;
  let chosen: Body | null = null;
  let hover: Body | null = null;
  let dirty = true;
  let shadowsStale = true;
  let visible = true;
  let cursor: Sq | null = null;

  const liftFor = (b: Body) => {
    if (b === chosen) return b.mode === 'carry' ? LIFT.carry : LIFT.chosen;
    if (b === hover && interactive && o.dests(b.sq ?? '').length) return LIFT.hover;
    return 0;
  };

  function showDots() {
    dots.forEach((d) => (d.visible = false));
    if (!chosen?.sq) return;
    o.dests(chosen.sq).forEach((s, i) => {
      const d = dots[i];
      if (!d) return;
      d.geometry = bySq.has(s) ? takeGeo : dotGeo;
      d.position.copy(square(s)).setY(BOARD.top + 0.004);
      d.visible = true;
    });
  }

  function choose(b: Body | null) {
    if (chosen === b) return;
    if (chosen && chosen.mode === 'rest' && chosen.sq) chosen.target.copy(square(chosen.sq));
    chosen = b;
    showDots();
    dirty = true;
  }

  // ---------------------------------------------------------------- travel
  // a hand's move: it gathers speed and lays the piece down as gently, never darting through the middle (a sine ease
  // peaks at half again the average speed; the cubic it replaced at three times)
  const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
  function fly(b: Body, to: Vector3, q1: Quaternion, opts: { arc?: number; dur?: number; delay?: number; spin?: number; end?: () => void } = {}) {
    // a fallen king stands up on the way; a promotion in progress completes
    unbend(b);
    const p0 = b.pos.clone();
    const dist = p0.distanceTo(to);
    const arc = opts.arc ?? 0.32 + dist * 0.07;
    const p1 = p0.clone().add(to).multiplyScalar(0.5);
    p1.y = Math.max(p0.y, to.y) + arc * 2;
    b.mode = 'flight';
    b.flight = {
      t: 0,
      dur: opts.dur ?? Math.min(0.62, 0.32 + dist * 0.05),
      p0,
      p1,
      p2: to.clone(),
      q0: b.group.quaternion.clone(),
      q1,
      spin: opts.spin ?? 0,
      delay: opts.delay ?? 0,
      end: opts.end ?? (() => {}),
    };
  }

  /** a piece is whole again: upright, its own shape, full size */
  function unbend(b: Body) {
    if (b.morph) setShape(b, b.morph.to);
    b.fall = null;
    b.morph = null;
    b.mesh.scale.set(1, 1, 1);
  }

  function place(b: Body, sq: Sq) {
    unbend(b);
    b.sq = sq;
    b.mode = 'rest';
    b.flight = null;
    b.pos.copy(square(sq));
    b.target.copy(b.pos);
    b.vel.set(0, 0, 0);
    b.tilt.set(0, 0);
    b.tiltV.set(0, 0);
    b.group.visible = true;
    b.group.position.copy(b.pos);
    b.group.quaternion.copy(upright);
    b.group.rotation.set(0, 0, 0);
  }

  function retire(b: Body) {
    unbend(b);
    b.sq = null;
    b.mode = 'off';
    b.flight = null;
    b.group.visible = false;
  }

  /** A taken piece rests on its side on the felt beside the board, as at a real table. */
  function lie(b: Body, slot: Vector3) {
    unbend(b);
    b.sq = null;
    b.mode = 'off';
    b.flight = null;
    b.group.visible = true;
    b.pos.copy(slot);
    b.target.copy(slot);
    b.group.position.copy(slot);
    b.group.quaternion.copy(lying);
    shadowsStale = true;
  }

  // ---------------------------------------------------------------- the case, the fallen king, the promotion
  // The ritual of a real folding chess box. Shut, it lies on the table with the near half of the board on its lid.
  // Opened, the lid swings over on its hinge and both halves lie velvet-up with the pieces lying in them; the pieces
  // come out one by one and stand on the table beside the box (White on the right, Black on the left); the box is
  // lifted and turned over, squares up; and each piece is set on its square.
  const X_AXIS = new Vector3(1, 0, 0);
  const T = BOARD.top;
  /** a half's pose: turned by `angle` about the x axis (its hinge line through its origin), its origin at (0, y, z) */
  const setPose = (k: number, angle: number, y: number, z: number) => {
    halves[k].quaternion.setFromAxisAngle(X_AXIS, angle);
    halves[k].position.set(0, y, z);
    shadowsStale = true;
    dirty = true;
  };
  /** in play: both halves as built */
  const poseOpen = () => {
    setPose(0, 0, 0, 0);
    setPose(1, 0, 0, 0);
  };
  /** shut: the far half lies velvet-up, the near half (the lid) closed down on it, squares up */
  const poseShut = () => {
    setPose(1, Math.PI, T, 0);
    setPose(0, 0, T, 0);
  };
  /** the lid opening: phi from PI (shut) to 0 (lying open beside, velvet up) */
  const poseLid = (phi: number) => setPose(0, phi + Math.PI, T, 0);
  /** both halves turned over together: psi from 0 (velvet up) to PI (squares up), lifted clear of the table */
  const poseTurn = (psi: number) => {
    const lift = (F - T / 2 + 0.35) * Math.sin(psi);
    for (const k of [0, 1]) setPose(k, psi + Math.PI, T / 2 + (T / 2) * Math.cos(psi) + lift, (T / 2) * Math.sin(psi));
  };

  interface Packed {
    b: Body;
    sq: Sq;
    /** lying in the velvet, as the box lies open velvet-up */
    slot: { p: Vector3; q: Quaternion };
    /** riding in the lid while it opens (Black's pieces): the slot in the lid's own frame */
    local: { p: Vector3; q: Quaternion } | null;
    /** standing on the table beside the box */
    stand: Vector3;
  }
  interface Unboxing {
    t: number;
    phase: 'open' | 'unpack' | 'turn' | 'place' | 'end';
    /** when the current phase began */
    at: number;
    landed: boolean;
    hooks: UnboxHooks;
    packed: Packed[];
    /** the order the pieces come out and go in */
    order: Packed[];
    next: number;
    flying: number;
    placed: number;
  }
  let unboxing: Unboxing | null = null;
  /** the extra points the camera keeps in view while the case is out: the pieces beside it, the box turned over */
  let caseView: Vec3[] = [];
  const LIFT_S = 0.72;
  const DROP_S = 0.4;
  const REBOUND_S = 0.3;
  const TURN_S = 1.0;
  /** how the pieces of a set come out and go in: rooks, knights, bishops, queens, kings, then the pawns, file by file */
  const ORDER: Record<Kind, number> = { r: 0, n: 1, b: 2, q: 3, k: 4, p: 5 };

  function fold(shut: boolean) {
    unboxing = null;
    caseView = [];
    if (shut) {
      poseShut();
      // the pieces are in the case
      for (const b of bodies) retire(b);
      bySq.clear();
      current = new Map();
    } else poseOpen();
    placeCamera(true);
  }

  /** Open the shut box and set out the pieces of `fen`; returns Skip. */
  function unbox(fen: string, hooks: UnboxHooks): () => void {
    fold(true);
    const next = readFen(fen);
    current = next;
    const floor = BOARD.frameDrop + PLATE + 0.004;
    const packed: Packed[] = [];
    for (const side of ['w', 'b'] as Side[]) {
      const mine = [...next.entries()].filter(([, p]) => p.side === side);
      const big = mine.filter(([, p]) => p.kind !== 'p').sort((a, b) => FILES.indexOf(a[0][0]) - FILES.indexOf(b[0][0]));
      const pawns = mine.filter(([, p]) => p.kind === 'p').sort((a, b) => FILES.indexOf(a[0][0]) - FILES.indexOf(b[0][0]));
      // White's pieces lie in the near tray, Black's in the lid's; each piece's head towards the hinge
      const s = side === 'w' ? 1 : -1;
      const lie = new Quaternion().setFromAxisAngle(X_AXIS, -s * (Math.PI / 2));
      [big, pawns].forEach((row, r) =>
        row.forEach(([sq, p], i) => {
          const b = spare(p.side, p.kind);
          const L = heightOf(p.kind);
          const zc = s * (r === 0 ? 1.35 : 3.2);
          const slotP = new Vector3(i - (row.length - 1) / 2, floor + girthOf(p.kind), zc + (s * L) / 2);
          const local = side === 'b' ? { p: new Vector3(slotP.x, T - slotP.y, -slotP.z), q: new Quaternion().setFromAxisAngle(X_AXIS, -Math.PI).multiply(lie) } : null;
          // standing on the table: White to the right of the box, Black to the left, pawns in the outer file
          const stand = new Vector3(s * (F + (r === 0 ? 1.2 : 2.1)), 0, (i - (row.length - 1) / 2) * 0.95 * -s);
          packed.push({ b, sq, slot: { p: slotP, q: lie.clone() }, local, stand });
          b.mode = 'stand';
          b.sq = null;
          b.group.visible = true;
          b.pos.copy(slotP);
          b.group.position.copy(slotP);
          b.group.quaternion.copy(lie);
        }),
      );
    }
    const order = [...packed].sort((a, b) => {
      const pa = next.get(a.sq)!;
      const pb = next.get(b.sq)!;
      return ORDER[pa.kind] - ORDER[pb.kind] || FILES.indexOf(a.sq[0]) - FILES.indexOf(b.sq[0]) || (pa.side === 'w' ? -1 : 1);
    });
    unboxing = { t: 0, phase: 'open', at: 0, landed: false, hooks, packed, order, next: 0, flying: 0, placed: 0 };
    // the camera stands back far enough to see the pieces set out beside the box and the lid as it opens
    const W2 = F + 2.6;
    caseView = [
      [W2, 0, 4.2],
      [-W2, 0, 4.2],
      [W2, 1.7, -4.2],
      [-W2, 1.7, -4.2],
      [0, T + F, 0],
    ];
    placeCamera(true);
    stepUnbox(0);
    caseSound('creak');
    return finishUnbox;
  }

  /** Skip: the box lies open squares-up with every piece in place. */
  function finishUnbox() {
    const u = unboxing;
    if (!u) return;
    unboxing = null;
    caseView = [];
    poseOpen();
    for (const k of u.packed) {
      place(k.b, k.sq);
      bySq.set(k.sq, k.b);
    }
    placeCamera(true);
    shadowsStale = true;
    dirty = true;
    u.hooks.done?.();
  }

  const tmpQ = new Quaternion();
  function stepUnbox(dt: number) {
    const u = unboxing!;
    u.t += dt;
    const t = u.t - u.at;
    if (u.phase === 'open') {
      let phi: number;
      if (t < LIFT_S) {
        // the lid lifted from shut to upright, a hand turning it
        phi = Math.PI - (Math.PI / 2) * (0.5 - Math.cos((Math.PI * t) / LIFT_S) / 2);
      } else if (t < LIFT_S + DROP_S) {
        // past upright it falls open under its own weight
        const e = (t - LIFT_S) / DROP_S;
        phi = (Math.PI / 2) * (1 - e * e);
      } else {
        if (!u.landed) {
          u.landed = true;
          caseSound('land');
          u.hooks.opened?.();
        }
        const e = (t - LIFT_S - DROP_S) / REBOUND_S;
        phi = e < 1 ? 0.05 * Math.sin(Math.PI * e) * (1 - e) : 0;
      }
      poseLid(phi);
      // Black's pieces ride in the lid
      tmpQ.setFromAxisAngle(X_AXIS, phi + Math.PI);
      for (const k of u.packed)
        if (k.local) {
          k.b.pos.copy(k.local.p).applyQuaternion(tmpQ).add(halves[0].position);
          k.b.group.position.copy(k.b.pos);
          k.b.group.quaternion.copy(tmpQ).multiply(k.local.q);
        }
      if (t >= LIFT_S + DROP_S + REBOUND_S + 0.2) {
        u.phase = 'unpack';
        u.at = u.t;
      }
      return;
    }
    if (u.phase === 'unpack') {
      // out of the velvet one at a time, White's tray first, each set standing beside the box
      while (u.next < u.packed.length && t >= u.next * 0.042) {
        const k = u.packed[u.next++];
        u.flying++;
        fly(k.b, k.stand, upright, {
          arc: 0.7,
          dur: 0.42,
          end: () => {
            k.b.mode = 'stand';
            k.b.flight = null;
            k.b.pos.copy(k.stand);
            k.b.group.position.copy(k.stand);
            k.b.group.quaternion.copy(upright);
            u.flying--;
            pieceDownSound(u.next, true);
          },
        });
      }
      if (u.next >= u.packed.length && !u.flying) {
        u.phase = 'turn';
        u.at = u.t;
        // the camera stands back while the box is lifted and turned over
        caseView = [...caseView, [0, T / 2 + 2 * F + 0.3, 0]];
        placeCamera(true);
      }
      return;
    }
    if (u.phase === 'turn') {
      const wait = 0.25;
      const e = Math.max(0, Math.min(1, (t - wait) / TURN_S));
      // eased in and out, as hands lift it, turn it and set it down
      poseTurn(Math.PI * (e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2));
      if (e >= 1) {
        caseSound('land');
        poseOpen();
        u.phase = 'place';
        u.at = u.t;
        u.next = 0;
        caseView = caseView.slice(0, -1);
        placeCamera(true);
      }
      return;
    }
    if (u.phase === 'place') {
      const start = 0.2;
      while (u.next < u.order.length && t >= start + u.next * 0.05) {
        const k = u.order[u.next++];
        const n = u.next - 1;
        const dest = square(k.sq);
        k.b.mode = 'rest';
        k.b.sq = k.sq;
        bySq.set(k.sq, k.b);
        u.flying++;
        fly(k.b, dest, upright, {
          arc: 0.75,
          dur: 0.42,
          end: () => {
            k.b.mode = 'rest';
            k.b.target.copy(dest);
            k.b.vel.set(0, -1.1, 0);
            u.flying--;
            u.placed++;
            pieceDownSound(n);
            u.hooks.piece?.(n);
          },
        });
      }
      if (u.placed >= u.order.length) {
        u.phase = 'end';
        u.at = u.t;
      }
      return;
    }
    if (t >= 0.35) {
      unboxing = null;
      caseView = [];
      placeCamera(true);
      u.hooks.done?.();
    }
  }

  /** Mate: the king goes over, away from the piece that gave it. */
  function topple(sq: Sq, from?: Sq) {
    const b = bySq.get(sq);
    if (!b || b.mode === 'off') return;
    const base = square(sq);
    const want = from ? base.clone().sub(square(from)).setY(0) : new Vector3(0.4, 0, 1);
    if (want.lengthSq() < 1e-6) want.set(0, 0, 1);
    want.normalize();
    // of sixteen directions round the square, the one nearest that keeps the fallen piece on the board (a king on the
    // edge falls along it or inward, not over the frame)
    const reach = heightOf(b.kind) + 0.05;
    const inside = (d: Vector3) => Math.abs(base.x + d.x * reach) < BOARD.half - 0.05 && Math.abs(base.z + d.z * reach) < BOARD.half - 0.05;
    // a direction with a piece in the way would lay it across that piece: an open one wins over a nearer one
    const blocked = (d: Vector3) =>
      [0.6, 1.1, reach - 0.1].some((t) => {
        const sq = (FILES[Math.round(base.x + d.x * t + 3.5)] + (Math.round(3.5 - (base.z + d.z * t)) + 1)) as Sq;
        return sq !== b.sq && bySq.has(sq);
      });
    let away = want.clone();
    let best = -Infinity;
    for (let i = 0; i < 16; i++) {
      const d = new Vector3(Math.cos((i / 16) * Math.PI * 2), 0, Math.sin((i / 16) * Math.PI * 2));
      if (!inside(d)) continue;
      const score = d.dot(want) - (blocked(d) ? 10 : 0);
      if (score > best) {
        best = score;
        away = d;
      }
    }
    if (best === -Infinity) away = base.clone().multiplyScalar(-1).setY(0).normalize();
    // it turns about the rim of its base on the side it falls to
    const pivot = base.clone().addScaledVector(away, girthOf(b.kind));
    const axis = new Vector3(0, 1, 0).cross(away).normalize();
    b.flight = null;
    b.mode = 'rest';
    b.vel.set(0, 0, 0);
    b.tilt.set(0, 0);
    b.tiltV.set(0, 0);
    b.pos.copy(base);
    b.fall = { t: motionOn ? 0 : FALL_END, axis, pivot, base };
    if (!motionOn) fallSound();
    poseFall(b);
  }
  const FALL_S = 0.48;
  const FALL_END = FALL_S + 0.36;
  /** the angle of a falling piece over time: gravity to the board, one bounce, at rest a little past level (the head
   *  is narrower than the base) */
  const fallAngle = (t: number) => {
    const rest = Math.PI / 2 + 0.05;
    if (t < FALL_S) return rest * (t / FALL_S) ** 2;
    const u = Math.min(1, (t - FALL_S) / (FALL_END - FALL_S));
    return rest - 0.13 * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u);
  };
  const fallQ = new Quaternion();
  const fallV = new Vector3();
  function poseFall(b: Body) {
    const f = b.fall!;
    fallQ.setFromAxisAngle(f.axis, fallAngle(f.t));
    fallV.copy(f.base).sub(f.pivot).applyQuaternion(fallQ).add(f.pivot);
    b.group.position.copy(fallV);
    b.group.quaternion.copy(fallQ);
    shadowsStale = true;
    dirty = true;
  }

  /** A pawn reaching the last rank: it sinks into the square and the new piece rises out of it. */
  function promote(b: Body, kind: Kind) {
    if (!motionOn) return setShape(b, kind);
    b.morph = { t: 0, to: kind, swapped: false };
  }
  const SINK_S = 0.16;
  function stepMorph(b: Body, dt: number) {
    const m = b.morph!;
    m.t += dt;
    let sy: number;
    let sx: number;
    if (m.t < SINK_S) {
      const e = m.t / SINK_S;
      sy = 1 - 0.85 * e * e;
      sx = 1 - 0.15 * e;
    } else {
      if (!m.swapped) {
        m.swapped = true;
        setShape(b, m.to);
        promoteSound();
      }
      const u = m.t - SINK_S;
      const k = Math.exp(-7 * u) * Math.cos(12 * u);
      sy = 1 - 0.85 * k;
      sx = 1 - 0.15 * k;
      if (u > 0.7) {
        b.morph = null;
        sy = sx = 1;
      }
    }
    b.mesh.scale.set(sx, sy, sx);
    shadowsStale = true;
  }

  let current = new Map<Sq, Placed>();
  let takenCount = 0;

  function setPosition(fen: string, animate = true) {
    const next = readFen(fen);
    const plan = planMoves(current, next);
    current = next;
    choose(null);
    const go = animate && motionOn && visible;
    for (const s of plan.stay) {
      const b = bySq.get(s);
      if (b && b.mode === 'carry') {
        b.mode = 'rest';
        b.target.copy(square(s));
      }
      // a king that went over at mate stands up when the position moves on (a take-back, the next puzzle)
      if (b?.fall) {
        if (go) fly(b, square(s), upright, { arc: 0.12, dur: 0.42, end: () => ((b.mode = 'rest'), b.target.copy(square(s))) });
        else place(b, s);
      }
    }
    const moves = plan.travel.map((t) => ({ t, b: bySq.get(t.from)! })).filter((x) => x.b);
    const taken = plan.taken.map((s) => bySq.get(s)!).filter(Boolean);
    for (const { t } of moves) bySq.delete(t.from);
    for (const s of plan.taken) bySq.delete(s);
    for (const { t, b } of moves) bySq.set(t.to, b);

    if (!go) {
      for (const { t, b } of moves) {
        if (t.becomes) setShape(b, t.becomes);
        place(b, t.to);
      }
      if (o.keepTaken === false) {
        for (const b of taken) retire(b);
        for (const b of bodies) if (!b.sq && b.mode === 'off' && b.group.visible && !b.flight) retire(b);
      } else for (const b of taken) lie(b, outside(b.side, lyingCount(b.side), b.kind));
      for (const a of plan.arrive) {
        const b = spare(a.side, a.kind);
        place(b, a.to);
        bySq.set(a.to, b);
      }
      shadowsStale = true;
      dirty = true;
      return;
    }

    let longest = 0;
    moves.forEach(({ t, b }, i) => {
      b.sq = t.to;
      const kind = t.becomes;
      const dest = square(t.to);
      if (b.mode === 'carry' || (b.pos.distanceTo(dest.clone().setY(b.pos.y)) < 0.05 && b.pos.y > BOARD.top + 0.1)) {
        // already in the hand above the square: set it down
        b.mode = 'rest';
        b.target.copy(dest);
        if (kind) promote(b, kind);
        return;
      }
      fly(b, dest, upright, {
        delay: i * 0.05,
        end: () => {
          b.mode = 'rest';
          b.target.copy(dest);
          // set down where it lands: the ease has already slowed it to rest (a push down sank it into the lacquer)
          b.vel.set(0, 0, 0);
          if (kind) promote(b, kind);
        },
      });
      longest = Math.max(longest, b.flight!.dur + b.flight!.delay);
    });
    // a capture takes one piece; several leaving at once is a jump to another position, which a puzzle or a lesson
    // does not lay out beside the board
    if (o.keepTaken === false && taken.length > 1) taken.forEach(retire);
    else taken.forEach((b) => {
      const slot = outside(b.side, lyingCount(b.side) + takenCount++, b.kind);
      b.sq = null;
      fly(b, slot, lying, { arc: 0.9, dur: 0.7, delay: longest * 0.8, spin: Math.PI * 2, end: () => ((takenCount = Math.max(0, takenCount - 1)), lie(b, slot)) });
    });
    plan.arrive.forEach((a, i) => {
      const b = spare(a.side, a.kind);
      if (!b.group.visible) {
        b.pos.copy(outside(a.side, i, a.kind));
        b.group.position.copy(b.pos);
        b.group.quaternion.copy(lying);
      }
      b.group.visible = true;
      b.sq = a.to;
      bySq.set(a.to, b);
      fly(b, square(a.to), upright, { arc: 0.8, delay: 0.05 * i, end: () => ((b.mode = 'rest'), b.target.copy(square(a.to))) });
    });
    dirty = true;
  }

  const spinQ = new Quaternion();
  const yAxis = new Vector3(0, 1, 0);
  const bez = (f: Flight, t: number, out: Vector3) => {
    const a = (1 - t) * (1 - t);
    const b2 = 2 * (1 - t) * t;
    const c = t * t;
    out.set(a * f.p0.x + b2 * f.p1.x + c * f.p2.x, a * f.p0.y + b2 * f.p1.y + c * f.p2.y, a * f.p0.z + b2 * f.p1.z + c * f.p2.z);
  };

  function step(dt: number): boolean {
    let moving = false;
    if (unboxing) {
      stepUnbox(dt);
      moving = true;
    }
    for (const b of bodies) {
      if (b.mode === 'off' || b.mode === 'stand') continue;
      if (b.fall) {
        if (b.fall.t < FALL_END) {
          live.add(b);
          const was = b.fall.t;
          b.fall.t = Math.min(FALL_END, b.fall.t + dt);
          if (was < FALL_S && b.fall.t >= FALL_S) fallSound();
          poseFall(b);
          moving = true;
        }
        continue;
      }
      if (b.morph) {
        stepMorph(b, dt);
        live.add(b);
        moving = true;
      }
      if (b.mode === 'flight' && b.flight) {
        const f = b.flight;
        live.add(b);
        if (f.delay > 0) {
          f.delay -= dt;
          moving = true;
          continue;
        }
        f.t = Math.min(1, f.t + dt / f.dur);
        const e = ease(f.t);
        bez(f, e, b.pos);
        b.group.quaternion.slerpQuaternions(f.q0, f.q1, e);
        if (f.spin) b.group.quaternion.premultiply(spinQ.setFromAxisAngle(yAxis, f.spin * e));
        b.group.position.copy(b.pos);
        if (f.t >= 1) {
          b.flight = null;
          b.target.copy(f.p2);
          b.vel.set(0, 0, 0);
          f.end();
        }
        moving = true;
        continue;
      }
      if (b.mode === 'rest') b.target.y = BOARD.top + liftFor(b);
      const sp = b.mode === 'carry' ? CARRY : REST;
      const dx = b.target.x - b.pos.x;
      const dy = b.target.y - b.pos.y;
      const dz = b.target.z - b.pos.z;
      if (motionOn) {
        b.vel.x += (sp.k * dx - sp.c * b.vel.x) * dt;
        b.vel.y += (sp.k * dy - sp.c * b.vel.y) * dt;
        b.vel.z += (sp.k * dz - sp.c * b.vel.z) * dt;
        b.pos.addScaledVector(b.vel, dt);
        const lean = b.mode === 'carry' ? 0.055 : 0;
        const tx = Math.max(-0.32, Math.min(0.32, b.vel.z * lean));
        const tz = Math.max(-0.32, Math.min(0.32, -b.vel.x * lean));
        b.tiltV.x += (TILT.k * (tx - b.tilt.x) - TILT.c * b.tiltV.x) * dt;
        b.tiltV.y += (TILT.k * (tz - b.tilt.y) - TILT.c * b.tiltV.y) * dt;
        b.tilt.x += b.tiltV.x * dt;
        b.tilt.y += b.tiltV.y * dt;
      } else {
        b.pos.copy(b.target);
        b.vel.set(0, 0, 0);
        b.tilt.set(0, 0);
        b.tiltV.set(0, 0);
      }
      const still =
        Math.abs(dx) + Math.abs(dy) + Math.abs(dz) < 1e-4 && b.vel.lengthSq() < 1e-8 && Math.abs(b.tilt.x) + Math.abs(b.tilt.y) < 1e-4 && b.tiltV.lengthSq() < 1e-8;
      if (!still) {
        moving = true;
        live.add(b);
      }
      b.group.position.copy(b.pos);
      b.group.rotation.set(b.tilt.x, 0, b.tilt.y);
    }
    return moving;
  }

  // ---------------------------------------------------------------- pointer
  const ray = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane(new Vector3(0, 1, 0), -BOARD.top);
  const hitPoint = new Vector3();
  let pointer: { x: number; y: number } | null = null;
  let pointerMoved = false;
  let down: { x: number; y: number; id: number; body: Body | null; was: Body | null; moved: boolean } | null = null;

  function aim(cx: number, cy: number) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  function pickBody(cx: number, cy: number, exact: boolean): Body | null {
    aim(cx, cy);
    scene.updateMatrixWorld();
    const list: Mesh[] = [];
    for (const b of bodies) if (b.sq && b.mode !== 'off') list.push(exact ? b.mesh : b.hit);
    const hit = ray.intersectObjects(list, false)[0];
    if (!hit) return null;
    return bodies.find((b) => b.mesh === hit.object || b.hit === hit.object) ?? null;
  }
  function boardPoint(cx: number, cy: number): Vector3 | null {
    aim(cx, cy);
    return ray.ray.intersectPlane(plane, hitPoint);
  }
  function squareAt(p: Vector3 | null): Sq | null {
    if (!p) return null;
    const f = Math.floor(p.x + 4);
    const r = Math.floor(4 - p.z);
    return f >= 0 && f < 8 && r >= 0 && r < 8 ? FILES[f] + (r + 1) : null;
  }
  const reaches = (s: Sq | null) => !!chosen?.sq && !!s && o.dests(chosen.sq).includes(s);
  const movable = (b: Body | null) => !!b?.sq && interactive && o.dests(b.sq).length > 0;

  /** What a press means: the drawn piece; else a square the chosen piece can reach; else a piece close by. */
  function under(cx: number, cy: number): { body: Body | null; sq: Sq | null } {
    const exact = pickBody(cx, cy, true);
    if (exact) return { body: exact, sq: exact.sq };
    const s = squareAt(boardPoint(cx, cy));
    if (reaches(s)) return { body: s ? bySq.get(s) ?? null : null, sq: s };
    const near = pickBody(cx, cy, false);
    if (near) return { body: near, sq: near.sq };
    return { body: s ? bySq.get(s) ?? null : null, sq: s };
  }

  function nudge(b: Body) {
    if (!motionOn) return;
    const a = Math.random() * Math.PI * 2;
    b.tiltV.x += Math.cos(a) * 2.4;
    b.tiltV.y += Math.sin(a) * 2.4;
    dirty = true;
  }

  function press(s: Sq) {
    if (!interactive) return;
    if (o.onSquare?.(s)) return;
    const b = bySq.get(s) ?? null;
    if (chosen && chosen.sq && reaches(s)) {
      const from = chosen.sq;
      choose(null);
      o.onMove(from, s);
      return;
    }
    if (b && movable(b)) {
      choose(chosen === b ? null : b);
      return;
    }
    if (b) nudge(b);
    choose(null);
  }

  const ignore = (e: Event) => !!(e.target as Element | null)?.closest?.('button, a, [data-board-ui]');

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || down || ignore(e) || !interactive) return;
    const { body: b, sq } = under(e.clientX, e.clientY);
    if (!sq) {
      choose(null);
      return;
    }
    e.preventDefault();
    if (o.onSquare?.(sq)) return;
    if (chosen && b !== chosen && reaches(sq)) {
      const from = chosen.sq!;
      choose(null);
      o.onMove(from, sq);
      return;
    }
    if (!movable(b)) {
      if (b) nudge(b);
      choose(null);
      return;
    }
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, body: b, was: chosen, moved: false };
    choose(b);
    try {
      o.host.setPointerCapture(e.pointerId);
    } catch {
      /* best effort */
    }
  }

  function onPointerMove(e: PointerEvent) {
    pointer = { x: e.clientX, y: e.clientY };
    pointerMoved = true;
    if (!down || e.pointerId !== down.id || !down.body) return;
    if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
      down.moved = true;
      down.body.mode = 'carry';
      down.body.flight = null;
    }
    if (down.moved) {
      const p = boardPoint(e.clientX, e.clientY);
      if (p) {
        const lim = BOARD.half + 0.6;
        down.body.target.set(Math.max(-lim, Math.min(lim, p.x)), BOARD.top + LIFT.carry, Math.max(-lim, Math.min(lim, p.z)));
        const s = squareAt(p);
        const ok = reaches(s);
        overTile.visible = ok;
        if (ok && s) overTile.position.copy(square(s)).setY(BOARD.top + 0.002);
      }
      dirty = true;
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!down || e.pointerId !== down.id) return;
    const d = down;
    down = null;
    try {
      o.host.releasePointerCapture(e.pointerId);
    } catch {
      /* not captured */
    }
    overTile.visible = false;
    const b = d.body!;
    if (d.moved) {
      const s = squareAt(new Vector3(b.target.x, BOARD.top, b.target.z));
      if (s && reaches(s)) {
        const from = b.sq!;
        choose(null);
        o.onMove(from, s);
        // the page answers with setPosition; until then the piece waits where it was dropped
        return;
      }
      b.mode = 'rest';
      if (b.sq) b.target.copy(square(b.sq));
      choose(null);
    } else if (d.was === b) {
      choose(null);
    }
    dirty = true;
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1 || ignore(e) || !interactive) return;
    const t = e.touches[0];
    const u = under(t.clientX, t.clientY);
    if (movable(u.body) || reaches(u.sq)) e.preventDefault();
  }
  function onLeave() {
    pointer = null;
    if (hover) {
      hover = null;
      dirty = true;
    }
  }

  o.host.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  o.host.addEventListener('pointerleave', onLeave);
  o.host.addEventListener('touchstart', onTouchStart, { passive: false });

  // ---------------------------------------------------------------- size, light, colour
  let W = 1;
  let H = 1;
  let fits = 0;
  let sized = '';
  function fit() {
    fits++;
    const r = o.host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    // setting the canvas to the size it already has reallocates its buffers (a stall): only a real change
    const size = `${W}x${H}@${renderer.getPixelRatio()}`;
    if (size !== sized) {
      sized = size;
      renderer.setSize(W, H, false);
      lensFx?.setSize(W, H);
      stillPic?.setSize();
      stillOk = false;
    }
    lens.snap = true;
    portrait = W / H < 0.85;
    elevation = preset().el;
    el = elevation;
    az = azimuthFor();
    relay();
    placeCamera(true);
  }
  const lens: { at: { fov: number; ox: number; oy: number } | null; to: { fov: number; ox: number; oy: number }; snap: boolean } = {
    at: null,
    to: { fov: 30, ox: 0, oy: 0 },
    snap: true,
  };
  function applyLens() {
    if (!lens.at) return;
    // a picture from another view is no picture of this one
    stillOk = false;
    camera.fov = lens.at.fov;
    camera.aspect = W / H;
    camera.setViewOffset(W, H, lens.at.ox, lens.at.oy, W, H);
    camera.updateProjectionMatrix();
  }
  function placeCamera(refit: boolean) {
    stillOk = false;
    const rig = rigFor(az, el, preset().dist);
    camera.position.set(...rig.camera);
    camera.lookAt(...rig.target);
    if (refit) {
      if (ranksPlane.visible !== tight()) {
        ranksPlane.visible = tight();
        drawInlay();
      }
      // the board sits in the part of the table the broadcast graphics leave free (CSS --inset-*)
      const cs = getComputedStyle(o.host);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const px = (n: string) => {
        const v = cs.getPropertyValue(n).trim();
        return (parseFloat(v) || 0) * (v.endsWith('rem') ? rem : 1);
      };
      const box = { x: px('--inset-left'), y: px('--inset-top'), w: W - px('--inset-left') - px('--inset-right'), h: H - px('--inset-top') - px('--inset-bottom') };
      const f = frameBounds(
        boardBounds(rigFor(azimuthFor(), elevation, preset().dist), tight(), caseView, cinema && portrait ? 0.74 : 1),
        W,
        H,
        box.w > 50 && box.h > 50 ? box : undefined,
      );
      lens.to = { fov: f.fov, ox: f.ox, oy: f.oy };
      // a resize or the first frame snaps; a change of the free space (the coach saying more) eases, like a
      // broadcast camera reframing
      if (!lens.at || !motionOn || lens.snap) lens.at = { ...lens.to };
      lens.snap = false;
      applyLens();
    }
    dirty = true;
  }

  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  function recolour() {
    accent.set(token('--pointer'));
    markMat.color.copy(accent);
    lastMat.color.set(token('--last'));
    overMat.color.copy(accent);
    ringMat.color.copy(accent);
    // check is a warning, so it glows in the status red, as on the flat board
    glowMat.color.set(token('--red'));
    dangerMat.color.set(token('--red'));
    dangerWash.color.set(token('--red'));
    for (const a of arrows) {
      a.mat.uniforms.uColor.value.copy(accent);
      if (a.badge) ((a.badge.children[0] as Mesh).material as MeshBasicMaterial).color.copy(accent);
    }
    // with the room lighting the scene, the sky-and-ground fill steps back and the lamp is the key
    hemi.intensity = realism ? world.fill : STUDIO.hemi;
    key.intensity = realism ? world.lamp.power : STUDIO.lamp;
    renderer.toneMappingExposure = realism ? world.exposure : STUDIO.exposure;
    dirty = true;
  }
  scheme.addEventListener('change', recolour);
  recolour();

  const ro = new ResizeObserver(fit);
  ro.observe(o.host);
  fit();
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      if (visible) dirty = true;
    },
    { rootMargin: '80px' },
  );
  io.observe(o.host);

  const focusAt = new Vector3();
  /** switches for measuring what a frame costs (set from the development hook __board.exp; all off in use) */
  const exp = { noShadows: false, noDof: false, noAdapt: false, noStill: false };
  // ---------------------------------------------------------------- the still table (still.ts)
  /** the layer the moving pieces are drawn on, over the still picture */
  const MOVING = 5;
  /** what moved this frame (step fills it) */
  const live = new Set<Body>();
  /** left out of the still picture, and drawn over it every frame until all of them rest */
  const out = new Set<Body>();
  /** counts the cheap frames, to draw the moving shadow every other one */
  let shadowBeat = 0;
  /** set by tick when nothing but pieces moves this frame: the camera, the arrows and the case all hold still */
  let calm = false;
  /** the last frame was drawn the cheap way: the next still one is drawn whole */
  let cheapLast = false;
  /** something that stands still changed while pieces moved (the last move's squares): drawn when they land */
  let stillStale = false;
  // a moving piece's shadow, over the picture: while pieces move the lamp's shadow map holds only them, and two
  // see-through catchers, the board's face and the table, take that shadow and nothing else (they live on the moving
  // layer, so no full frame ever draws them)
  const catchMat = own(new ShadowMaterial({ opacity: 0.42, depthWrite: false }));
  const catchers = [
    new Mesh(keep(new PlaneGeometry(2 * (BOARD.half + BOARD.frame), 2 * (BOARD.half + BOARD.frame)).rotateX(-Math.PI / 2)), catchMat),
    new Mesh(keep(new PlaneGeometry(60, 60).rotateX(-Math.PI / 2)), catchMat),
  ];
  catchers[0].position.y = BOARD.top + 0.0012;
  catchers[1].position.y = 0.0012;
  for (const c of catchers) {
    c.receiveShadow = true;
    // soft (VSM) shadows draw every receiver into the map as well: not these, or they shadow themselves
    c.onBeforeShadow = hideDraw;
    c.onAfterShadow = showDraw;
    c.renderOrder = 2;
    c.layers.set(MOVING);
    board.add(c);
  }

  function makeStill() {
    stillPic = createStill(renderer);
    stillPic.setSize();
    // its programs and its buffers now, while nothing moves, not at the first move: the marks and the arrows too,
    // hidden now but brought in by a move or a replay (one compiled during a move stalled it 130 ms)
    const shown = [dots[0], lastTiles[0], overTile, checkGlow, cursorRing].map((m) => [m, m.visible] as const);
    shown.forEach(([m]) => (m.visible = true));
    const wash = new Mesh(tileGeo, dangerWash);
    const ring = new Mesh(takeGeo, dangerMat);
    board.add(wash, ring);
    for (const c of catchers) c.layers.enable(0);
    const hadArrows = arrows.length > 0;
    if (!hadArrows) drawArrows([{ from: 'e2', to: 'e4', label: '1' }, { from: 'g1', to: 'f3' }]);
    stillPic.compile(scene, camera);
    if (!hadArrows) clearArrows();
    board.remove(wash, ring);
    shown.forEach(([m, v]) => (m.visible = v));
    // and for the screen, where they are drawn
    renderer.compile(scene, camera);
    for (const c of catchers) c.layers.disable(0);
    stillPic.draw(scene, camera);
    // the move's hints are drawn over the picture, never in it: they go the moment a move is made
    for (const ob of [...dots, cursorRing]) ob.layers.enable(MOVING);
  }
  /** the picture again, without these (what moves, or is about to) */
  function drawStill(movers: Iterable<Body>) {
    for (const b of out) for (const ob of [b.mesh, b.proxy, contacts.get(b), reflections.get(b)]) ob?.layers.disable(MOVING);
    out.clear();
    for (const b of movers) out.add(b);
    stillStale = false;
    const hidden: [Object3D, boolean][] = [];
    for (const b of out) for (const ob of [b.group, contacts.get(b), reflections.get(b)]) if (ob) (hidden.push([ob, ob.visible]), (ob.visible = false));
    for (const ob of [...dots, cursorRing]) (hidden.push([ob, ob.visible]), (ob.visible = false));
    if (!exp.noShadows) renderer.shadowMap.needsUpdate = true;
    stillPic!.draw(scene, camera);
    for (const [ob, v] of hidden) ob.visible = v;
    // the lights must reach the moving layer (a prop's light comes and goes with its room)
    scene.traverse((ob) => {
      if ((ob as Light).isLight) ob.layers.enable(MOVING);
    });
    for (const b of out) for (const ob of [b.mesh, contacts.get(b), reflections.get(b)]) ob?.layers.enable(MOVING);
    stillOk = true;
  }
  function drawMoving() {
    stillPic!.lay();
    const bg = scene.background;
    scene.background = null;
    camera.layers.set(MOVING);
    // the lamp's shadow map: only what moves, for the catchers and the moving pieces themselves; every other frame,
    // which a soft shadow does not show and the frame budget does (the map and its blur cost as much as the rest)
    if (!exp.noShadows && (shadowBeat++ & 1) === 0) {
      for (const b of out) (b.proxy ?? b.mesh).layers.enable(MOVING);
      key.shadow.camera.layers.set(MOVING);
      renderer.shadowMap.needsUpdate = true;
    }
    renderer.autoClear = false;
    renderer.render(scene, camera);
    renderer.autoClear = true;
    key.shadow.camera.layers.set(0);
    camera.layers.set(0);
    scene.background = bg;
  }
  /** Before a known move (the bot's, during its think): the picture without the pieces that will move, drawn now
   *  while the table is quiet, so their flight starts on cheap frames. */
  function prepare(sqs: Sq[]) {
    if (!stillPic || cinema || !motionOn || !visible) return;
    const bs = sqs.map((s) => bySq.get(s)).filter((b): b is Body => !!b);
    if (!bs.length || (stillOk && !dirty && bs.every((b) => out.has(b)))) return;
    ground();
    drawStill(bs);
    // the screen keeps its last full frame; the shadows go back to the full set at the next one
    shadowsStale = true;
  }

  function render() {
    ground();
    if (calm && live.size && stillPic && !cinema && !exp.noStill) {
      calm = false;
      // a piece starting to move that the picture still holds: the picture again, without everything that moves (a
      // piece picked up pays this as it lifts, so its flight finds the picture ready; the bot's is made in its think)
      let fresh = !stillOk;
      for (const b of live) if (!out.has(b)) fresh = true;
      if (fresh) drawStill(live);
      // otherwise what stands still changing while pieces move (the last move's squares) waits for them to land
      else if (dirty) stillStale = true;
      drawMoving();
      cheapLast = true;
      dirty = false;
      return;
    }
    calm = false;
    // the picture stays good for the next move of the same pieces, unless what stands still has changed
    if (dirty || stillStale) stillOk = false;
    if (cheapLast) {
      cheapLast = false;
      stillStale = false;
      // the shadows held still with the picture: this frame draws them where the pieces now stand
      shadowsStale = true;
    }
    if ((shadowsStale || dirty) && !exp.noShadows) {
      renderer.shadowMap.needsUpdate = true;
      shadowsStale = false;
    }
    if (cinema && lensFx && !exp.noDof) {
      // the focus lies a little in front of the middle of the board, on the player's side
      focusAt.set(0, BOARD.top + 0.5, orientation === 'w' ? 2.2 : -2.2);
      lensFx.render(scene, camera, camera.position.distanceTo(focusAt));
    } else renderer.render(scene, camera);
    dirty = false;
  }

  // ---------------------------------------------------------------- the room and the set, changed in place
  /** A material in the room's light: its own strength of reflection (kept the first time), scaled for the room, the
   *  photograph turned as the room is. */
  function lit<T extends Material>(m: T): T {
    const p = m as unknown as MeshPhysicalMaterial;
    if (!p.envMap) return m;
    if (p.userData.env0 === undefined) p.userData.env0 = p.envMapIntensity;
    p.envMap = room;
    p.envMapIntensity = p.userData.env0 * (realism ? world.reflect : 1);
    p.envMapRotation.set(0, realism ? world.turn : 0, 0);
    return m;
  }
  /** Everything in the room's light: the board, the table, the props and every piece, lying or standing. */
  function applyRoom() {
    scene.traverse((ob) => {
      const m = (ob as Mesh).material;
      if (!m) return;
      (Array.isArray(m) ? m : [m]).forEach((x) => lit(x));
    });
    shadowsStale = true;
    dirty = true;
  }
  function applyWorld() {
    if (realism) {
      scene.background = room;
      scene.backgroundBlurriness = world.blur;
      scene.backgroundIntensity = world.backdrop;
      scene.backgroundRotation.set(0, world.turn, 0);
      key.color.set(world.lamp.color);
      key.angle = world.lamp.cone;
    }
    buildProps();
    placeProps();
    applyRoom();
    placeKey();
    recolour();
  }
  let looking = 0;
  let disposed = false;
  /** Another room: its photograph and table load, then the board is moved into it in one frame. */
  async function setWorld(id: WorldId) {
    if (!realism || id === world.id) return;
    const ticket = ++looking;
    let r: Room;
    try {
      r = await loadRoom(id);
    } catch {
      return;
    }
    if (ticket !== looking || disposed) {
      r.hdr.dispose();
      return;
    }
    world = WORLDS[id];
    const old = room;
    room = roomLight(renderer, r);
    r.hdr.dispose();
    dressTable(r);
    applyWorld();
    old.dispose();
  }
  /** Another set: each piece takes the new finish where it stands. */
  function setPieces(id: PieceSetId) {
    if (!realism || id === pieceSet || !turnedWood) return;
    pieceSet = id;
    tintReflections();
    for (const b of bodies) {
      const old = b.mesh.material as Material;
      b.mesh.material = turnedWood(b.side);
      old.dispose();
    }
    dirty = true;
  }
  applyWorld();
  tintReflections();

  // warm every program the board will use (the pieces of both colours, marks, an arrow) before the first move
  {
    // the whole set, so a page that sets it out (or the opening, all at once) finds every body made, every material
    // set up and every shape already on the GPU: made at the tap, they stalled its first frame
    const warm = [...readFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1').entries()].map(([sq, p]) => {
      const b = makeBody(p.side, p.kind);
      place(b, sq);
      return b;
    });
    drawArrows([{ from: 'e2', to: 'e4', label: '1' }, { from: 'g1', to: 'f3' }]);
    dots[0].visible = true;
    lastTiles[0].visible = true;
    checkGlow.visible = true;
    // the contact shadow's program too, or it compiles the first time a piece stands up (a stall mid-opening)
    ground();
    renderer.compile(scene, camera);
    render();
    warm.forEach(retire);
    dots[0].visible = false;
    lastTiles[0].visible = false;
    checkGlow.visible = false;
    // the warm-up arrows stay out of sight but their programs stay compiled
    clearArrows();
  }

  // ---------------------------------------------------------------- frame
  let orbitSpeed = 0;
  let orbitT = 0;
  let frames = 0;
  let slow = 0;
  let quiet = 0;
  let dprWanted = 0;
  function tick(seconds: number) {
    if (!visible) return;
    const dt = Math.min(seconds, 1 / 20);
    if (pointer && !down && pointerMoved) {
      pointerMoved = false;
      const r = o.host.getBoundingClientRect();
      const inside = pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom;
      const u = inside ? under(pointer.x, pointer.y) : { body: null, sq: null };
      if (u.body !== hover) {
        hover = u.body;
        dirty = true;
      }
      o.host.style.cursor = reaches(u.sq) && u.body !== chosen ? 'pointer' : movable(u.body) ? 'grab' : '';
    }
    if (down?.moved) o.host.style.cursor = 'grabbing';

    let moving = false;
    live.clear();
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) moving = step(dt / n) || moving;
    if (moving) shadowsStale = true;

    // anything but the pieces moving (the arrows, the camera, the case) draws the whole frame
    let busyView = !!unboxing;
    // arrows draw on from the tail; the numbers land when the line is drawn
    if (arrows.length && arrowClock < 1) {
      busyView = true;
      arrowClock = motionOn ? Math.min(1, arrowClock + dt / 0.32) : 1;
      const e = 1 - Math.pow(1 - arrowClock, 3);
      arrows.forEach((a, i) => {
        const local = Math.max(0, Math.min(1, e * arrows.length - i * 0.35));
        a.mat.uniforms.uProgress.value = arrows.length === 1 ? e : Math.min(1, local * 1.2);
      });
      moving = true;
    }

    if (lens.at && (Math.abs(lens.at.fov - lens.to.fov) > 1e-3 || Math.abs(lens.at.oy - lens.to.oy) > 0.05 || Math.abs(lens.at.ox - lens.to.ox) > 0.05)) {
      const k = 1 - Math.exp(-dt * 7);
      lens.at.fov += (lens.to.fov - lens.at.fov) * k;
      lens.at.ox += (lens.to.ox - lens.at.ox) * k;
      lens.at.oy += (lens.to.oy - lens.at.oy) * k;
      applyLens();
      moving = true;
      busyView = true;
    }
    // a slow swing round the table on the home page; anywhere a game, lesson or puzzle is played the camera stays
    // put (Luca, 2026-10-14: "make the board to not move")
    if (motionOn && orbitSpeed) {
      orbitT += orbitSpeed * dt;
      az = azimuthFor() + Math.sin(orbitT) * 0.32;
      placeCamera(false);
      moving = true;
      busyView = true;
    }

    calm = !busyView;
    // the pieces have come to rest: one full frame puts them back in the room's light and shadows
    const settle = !moving && cheapLast;
    if (moving || dirty || settle) {
      render();
      frames++;
      if (seconds > 1 / 40) slow++;
      if (frames === 45) {
        // too slow: a lower resolution, but only once nothing moves (resizing the canvas stalls a frame)
        if (slow > 15 && dpr > 1 && !exp.noAdapt) dprWanted = Math.max(1, dpr - 0.5);
        frames = 0;
        slow = 0;
      }
    }
    if (!moving && dprWanted && dprWanted !== dpr) {
      dpr = dprWanted;
      renderer.setPixelRatio(dpr);
      fit();
      dirty = true;
    }
    // the still picture is made once the table has been quiet a moment (not for the home screen's lens, which draws
    // every frame through its own target)
    if (!stillPic && !cinema && !moving && !dirty && realism) {
      if (++quiet > 30) makeStill();
    } else quiet = 0;
  }

  function setMotion(on: boolean) {
    motionOn = on;
    if (!on) {
      finishUnbox();
      for (const b of bodies) {
        if (b.fall) {
          b.fall.t = FALL_END;
          poseFall(b);
        }
        if (b.morph) unbend(b);
      }
      if (down) down = null;
      for (const b of bodies) {
        if (b.flight) {
          const end = b.flight.end;
          b.flight = null;
          if (b.sq) place(b, b.sq);
          else end();
        }
      }
      for (const b of bodies) if (b.sq && b.mode !== 'off') place(b, b.sq);
      for (const b of bodies) if (!b.sq && b.mode !== 'off') lie(b, outside(b.side, lyingCount(b.side), b.kind));
      arrowClock = 1;
      arrows.forEach((a) => {
        a.mat.uniforms.uProgress.value = 1;
        if (a.badge) a.badge.visible = true;
      });
      az = azimuthFor();
      placeCamera(false);
      shadowsStale = true;
    }
    dirty = true;
    render();
  }

  const plate = document.createElement('p');
  plate.className = 'board-plate';
  plate.setAttribute('data-board-ui', '');
  plate.hidden = true;
  o.host.append(plate);

  if (import.meta.env.DEV) {
    // test hook: where a square is on screen, and what stands where
    const v = new Vector3();
    (window as unknown as Record<string, unknown>).__board = {
      square: (s: Sq) => {
        v.copy(square(s)).project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      piece: (s: Sq) => {
        const b = bySq.get(s);
        if (!b) return null;
        v.copy(b.pos).add(new Vector3(0, heightOf(b.kind) * 0.45, 0)).project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      state: () => ({ chosen: chosen?.sq ?? null, busy: view.busy, pieces: [...bySq.entries()].map(([s, b]) => `${b.side}${b.kind}${s}`).sort() }),
      // the case and the animations: the far leaf's angle, pieces lying over, a promotion under way
      fx: () => ({
        // 'play' when both halves lie as built, 'shut' when the lid lies closed on the other half
        box:
          halves[0].position.y === 0 && halves[1].position.y === 0 && halves[0].quaternion.w === 1
            ? 'play'
            : halves[0].position.y === T && halves[0].quaternion.w === 1
              ? 'shut'
              : 'moving',
        phase: unboxing?.phase ?? null,
        unboxing: !!unboxing,
        visible: bodies.filter((b) => b.group.visible).length,
        fallen: [...bySq.entries()].filter(([, b]) => b.fall).map(([s, b]) => ({ sq: s, tilt: Number((2 * Math.acos(Math.min(1, Math.abs(b.group.quaternion.w)))).toFixed(2)) })),
        morphing: bodies.filter((b) => b.morph).length,
      }),
      shadows: () => (vsm ? 'vsm' : 'pcf'),
      // the shader programs compiled so far, and how many times the canvas was resized (development only)
      programs: () => (renderer.info.programs ?? []).map((p) => `${p.name} ${(p.cacheKey as string).slice(0, 60)}`),
      fits: () => `${fits} ${sized}`,
      exp: (o: Partial<typeof exp>) => Object.assign(exp, o),
      // the pieces in motion this frame: where they are and how (development only, for measuring a move's path)
      still: () => ({ made: !!stillPic, ok: stillOk, out: [...out].map((b) => b.sq) }),
      // how dark a moving piece's shadow is over the picture (development only, for tuning the catchers)
      catchers: (opacity: number) => (catchMat.opacity = opacity),
      motion: () =>
        bodies
          .filter((b) => b.mode === 'flight' || b.mode === 'carry' || b.vel.lengthSq() > 1e-6)
          .map((b) => ({ sq: b.sq, mode: b.mode, x: b.pos.x, y: b.pos.y - BOARD.top, z: b.pos.z })),
      // how bright a light in the room may look in the lacquer (development only, for tuning noGlare)
      glare: (cap: number) => {
        GLARE.uGlareCap.value = cap;
        dirty = true;
      },
      // a free camera for close-up checks of the materials (development only)
      look: (x: number, y: number, z: number, tx: number, ty: number, tz: number, fov = 30) => {
        lens.at = { fov, ox: 0, oy: 0 };
        lens.to = { ...lens.at };
        camera.fov = fov;
        // close enough to touch the pieces: the near plane comes in with it
        camera.near = 0.3;
        camera.setViewOffset(W, H, 0, 0, W, H);
        camera.updateProjectionMatrix();
        camera.position.set(x, y, z);
        camera.lookAt(tx, ty, tz);
        orbitSpeed = 0;
        dirty = true;
      },
      danger: () => [...(marks.danger ?? [])],
    };
  }

  const view: BoardView = {
    kind: '3d',
    setPosition,
    setOrientation(side) {
      if (side === orientation) return;
      orientation = side;
      az = azimuthFor();
      placeKey();
      placeProps();
      drawInlay();
      placeCamera(true);
      shadowsStale = true;
    },
    setMarks(m) {
      marks = m;
      applyMarks();
    },
    refit() {
      placeCamera(true);
    },
    orbit(speed: number) {
      orbitSpeed = speed;
      if (!speed) {
        az = azimuthFor();
        placeCamera(false);
      }
    },
    fold,
    unbox,
    setWorld: (id) => void setWorld(id),
    setPieces,
    topple,
    setCinema(on: boolean) {
      cinema = on;
      if (on && realism && !lensFx) {
        lensFx = createFocus(renderer, { aperture: 1.0, maxBlur: 9 });
        sized = '';
        // every piece's program for the lens's target, with the set briefly out where it last stood
        const hidden = bodies.filter((b) => !b.group.visible);
        hidden.forEach((b) => (b.group.visible = true));
        ground();
        lensFx.compile(scene, camera);
        hidden.forEach((b) => (b.group.visible = false));
        ground();
      }
      fit();
      shadowsStale = true;
    },
    setAngle(i: number) {
      angle = Math.max(0, Math.min(ANGLES.length - 1, i));
      fit();
      shadowsStale = true;
    },
    cycleAngle() {
      angle = (angle + 1) % ANGLES.length;
      fit();
      shadowsStale = true;
      return ANGLES[angle].name;
    },
    prepare,
    setPlate(text) {
      plate.hidden = !text;
      plate.textContent = text ?? '';
      o.host.toggleAttribute('data-analysis', !!text);
    },
    press,
    setCursor(s) {
      cursor = s;
      cursorRing.visible = !!s;
      if (s) cursorRing.position.copy(square(s)).setY(BOARD.top + 0.006);
      dirty = true;
    },
    get chosen() {
      return chosen?.sq ?? null;
    },
    tick,
    setMotion,
    get busy() {
      return !!unboxing || bodies.some((b) => b.mode === 'flight' || b.mode === 'carry' || !!b.morph || b.vel.lengthSq() > 1e-4);
    },
    setInteractive(on: boolean) {
      interactive = on;
      if (!on) choose(null);
    },
    dispose() {
      disposed = true;
      ro.disconnect();
      io.disconnect();
      scheme.removeEventListener('change', recolour);
      o.host.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      o.host.removeEventListener('pointerleave', onLeave);
      o.host.removeEventListener('touchstart', onTouchStart);
      clearArrows();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      bodies.forEach((b) => (b.mesh.material as Material).dispose());
      tableMaps.forEach((t) => t.dispose());
      propParts.geos.forEach((g) => g.dispose());
      propParts.mats.forEach((m) => m.dispose());
      propParts.texs.forEach((t) => t.dispose());
      room.dispose();
      lensFx?.dispose();
      stillPic?.dispose();
      numbers.forEach((t) => t.dispose());
      inlayMap?.dispose();
      ranksMap?.dispose();
      studios.forEach((m) => m.dispose());
      renderer.dispose();
      canvas.remove();
      plate.remove();
    },
  };
  void cursor;
  return view;
}
