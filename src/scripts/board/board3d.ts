// The marble board in three.js. It owns no animation loop: the page steps it from GSAP's ticker, and it draws
// only when something changed. Pieces, marble and lighting come from the Salvato board; here both sides play,
// every rule of chess applies (chess.js decides), and the commentator draws on the squares.

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LatheGeometry,
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
import { BOARD, GIRTH, HEIGHT, KING_CROSS, KNIGHT_HEAD, PROFILES, QUEEN_CROWN, ROOK_MERLONS, knightOutline } from '../../lib/chess/model.ts';
import { boardBounds, frameBounds, rigFor } from './camera.ts';
import { FILES, planMoves, readFen, type Arrow, type BoardOptions, type BoardView, type Kind, type Marks, type Placed, type Side, type Sq } from './types.ts';

const token = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';

/** The studio: one lamp over the board, the room dark around it. The same in day and night themes: the table is
 *  a place, not a page colour. */
const STUDIO = { room: 0.45, hemi: 0.34, lamp: 3.6, exposure: 1.04 };

/** Where the camera stands. First, the player's own seat: straight behind your pieces and looking almost straight
 *  down (80 degrees, Luca's "more up"), close enough that the near ranks still loom a little. Then straight
 *  overhead, and the low three-quarter the home page orbits in, which has a steeper version for an upright phone.
 *  dist is from the middle of the board, in squares. */
export const ANGLES = [
  { name: 'Si lojtar', upright: { el: 1.396, az: 0, dist: 13 }, wide: { el: 1.396, az: 0, dist: 13 } },
  { name: 'Nga lart', upright: { el: 1.54, az: 0, dist: 15 }, wide: { el: 1.54, az: 0, dist: 15 } },
  { name: 'Afër tabelës', upright: { el: 0.72, az: -0.42, dist: 15 }, wide: { el: 0.56, az: -0.5, dist: 15 } },
];

/** How high a piece rides: under the pointer, chosen, in the hand. */
const LIFT = { hover: 0.05, chosen: 0.24, carry: 0.6 };
/** Springs: set down with the faintest overshoot; in the hand it follows close. */
const REST = { k: 170, c: 19 };
const CARRY = { k: 560, c: 42 };
const TILT = { k: 210, c: 17 };

type Mode = 'rest' | 'carry' | 'flight' | 'off';

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
  hit: Mesh;
  pos: Vector3;
  vel: Vector3;
  target: Vector3;
  tilt: Vector2;
  tiltV: Vector2;
  mode: Mode;
  flight: Flight | null;
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
function inlay(size: number, orientation: Side): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const F = BOARD.half + BOARD.frame;
  const k = size / (2 * F);
  const at = (x: number, z: number) => [(x + F) * k, (z + F) * k] as const;
  g.fillStyle = 'rgba(236, 214, 170, 0.9)';
  g.font = `600 ${Math.round(k * 0.27)}px "Mona Sans Variable", system-ui, sans-serif`;
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
    put(String(i + 1), side, 3.5 - i);
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
  g.fillStyle = '#111214';
  g.font = '800 84px "Mona Sans Variable", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(n, 64, 70);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** A soft round glow: the light under a king in check. */
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

export function createBoard3d(o: BoardOptions): BoardView {
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

  const camera = new PerspectiveCamera(30, 1, 4, 60);
  let orientation: Side = o.orientation;
  let elevation = 0.95;
  let az = 0;
  let el = elevation;
  let angle = 0;
  let portrait = true;
  const preset = () => (portrait ? ANGLES[angle].upright : ANGLES[angle].wide);
  const azimuthFor = () => (orientation === 'w' ? 0 : Math.PI) + preset().az;
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
  const placeKey = () => {
    // the lamp hangs high over the player's left shoulder, whichever side they play
    const s = orientation === 'w' ? 1 : -1;
    key.position.set(-12 * s, 20, 9 * s);
  };
  placeKey();

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const keep = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const own = <T extends Material>(m: T) => (materials.push(m), m);

  // reflections come from a studio map set on each material (scene.environment would light the table evenly)
  const room = studioFor(STUDIO.room);
  const cloth = felt(256);
  cloth.repeat.set(36, 36);
  cloth.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  textures.push(cloth);
  const table = new Mesh(keep(new PlaneGeometry(64, 64).rotateX(-Math.PI / 2)), own(new MeshStandardMaterial({ map: cloth, roughness: 1, envMap: room, envMapIntensity: 0.05 })));
  table.receiveShadow = true;
  scene.add(table);

  // ---------------------------------------------------------------- the board
  const board = new Group();
  scene.add(board);
  const F = BOARD.half + BOARD.frame;
  const frameH = BOARD.top - BOARD.frameDrop;
  const grain = grainTexture(512, '#4b2213', 'rgba(22,6,1,A)', 'rgba(150,72,40,A)', 23);
  textures.push(grain);
  const wood = own(new MeshPhysicalMaterial({ map: grain, roughness: 0.78, specularIntensity: 0.15, envMap: room, envMapIntensity: 0.7 }));
  const frame = new Mesh(keep(new RoundedBoxGeometry(2 * F, frameH, 2 * F, 5, 0.06)), wood);
  frame.position.y = frameH / 2;
  frame.castShadow = frame.receiveShadow = true;
  board.add(frame);
  // boxwood stringing let into the mahogany: one line round the squares, one near the outer edge
  const brass = own(new MeshStandardMaterial({ color: 0xe9d3a4, roughness: 0.85, envMap: room, envMapIntensity: 0.5 }));
  for (const [d, w] of [
    [BOARD.half + 0.075, 0.032],
    [F - 0.085, 0.022],
  ] as const) {
    for (const side of [0, 1, 2, 3]) {
      const len = 2 * d + w;
      const bar = new Mesh(keep(new BoxGeometry(side % 2 ? w : len, 0.012, side % 2 ? len : w)), brass);
      const off = side < 2 ? d : -d;
      if (side % 2) bar.position.set(off, frameH + 0.001, 0);
      else bar.position.set(0, frameH + 0.001, off);
      bar.receiveShadow = true;
      board.add(bar);
    }
  }
  const slab = new Mesh(keep(new BoxGeometry(2 * BOARD.half, 0.06, 2 * BOARD.half)), own(new MeshStandardMaterial({ color: 0xd9d4ca, roughness: 0.3 })));
  slab.position.y = BOARD.top - 0.031;
  slab.receiveShadow = true;
  board.add(slab);
  const fieldMap = woodSquares(Math.min(2048, renderer.capabilities.maxTextureSize));
  fieldMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  textures.push(fieldMap);
  const surface = new Mesh(
    keep(new PlaneGeometry(2 * BOARD.half, 2 * BOARD.half).rotateX(-Math.PI / 2)),
    own(new MeshPhysicalMaterial({ map: fieldMap, roughness: 0.88, specularIntensity: 0.08, envMap: room, envMapIntensity: 0.55 })),
  );
  surface.position.y = BOARD.top + 0.0005;
  surface.receiveShadow = true;
  board.add(surface);
  // the coordinates inlaid in the frame top
  const inlayMat = own(new MeshBasicMaterial({ transparent: true, depthWrite: false }));
  inlayMat.toneMapped = false;
  const inlayPlane = new Mesh(keep(new PlaneGeometry(2 * F, 2 * F).rotateX(-Math.PI / 2)), inlayMat);
  inlayPlane.position.y = frameH + 0.008;
  inlayPlane.renderOrder = 1;
  board.add(inlayPlane);
  let inlayMap: CanvasTexture | null = null;
  const drawInlay = () => {
    inlayMap?.dispose();
    inlayMap = inlay(1024, orientation);
    inlayMat.map = inlayMap;
    inlayMat.needsUpdate = true;
  };
  // the face may still be loading: draw now, and again once it is in
  drawInlay();
  document.fonts?.ready.then(() => {
    drawInlay();
    dirty = true;
  });

  // ---------------------------------------------------------------- the pieces
  const shapes = new Map<Kind, BufferGeometry>();
  const shapeOf = (k: Kind) => {
    let g = shapes.get(k);
    if (!g) shapes.set(k, (g = keep(turned(k))));
    return g;
  };
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
    if (!g) hitGeo.set(k, (g = keep(new CylinderGeometry(0.44, 0.44, HEIGHT[k] + 0.12, 12).translate(0, (HEIGHT[k] + 0.12) / 2, 0))));
    return g;
  };

  const bodies: Body[] = [];
  const bySq = new Map<Sq, Body>();
  const upright = new Quaternion();
  const lying = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
  // knights turn their profile to the player, looking a little up the board, so the head reads from above
  const knightYaw = (side: Side) => (side === 'w' ? Math.PI - 0.5 : -0.5);

  function setShape(b: Body, kind: Kind) {
    b.kind = kind;
    b.mesh.geometry = shapeOf(kind);
    b.hit.geometry = hitOf(kind);
    b.mesh.rotation.y = kind === 'n' ? knightYaw(b.side) : 0;
  }

  function makeBody(side: Side, kind: Kind): Body {
    const group = new Group();
    const mesh = new Mesh(shapeOf(kind), side === 'w' ? ivory : ebony);
    mesh.castShadow = mesh.receiveShadow = true;
    const hit = new Mesh(hitOf(kind), hitMat);
    group.add(mesh, hit);
    board.add(group);
    const b: Body = {
      side,
      kind,
      sq: null,
      group,
      mesh,
      hit,
      pos: new Vector3(),
      vel: new Vector3(),
      target: new Vector3(),
      tilt: new Vector2(),
      tiltV: new Vector2(),
      mode: 'off',
      flight: null,
    };
    setShape(b, kind);
    bodies.push(b);
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
    return new Vector3((F + gap + row * 0.95) * toward, GIRTH[kind], toward * near * (0.9 + (i % 4) * 0.85));
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
  const lastMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  lastMat.toneMapped = false;
  const ringMat = own(new MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }));
  ringMat.toneMapped = false;
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
  const overTile = new Mesh(tileGeo, lastMat);
  overTile.visible = false;
  board.add(overTile);
  const checkGlow = new Mesh(glowGeo, glowMat);
  checkGlow.visible = false;
  checkGlow.renderOrder = 1;
  board.add(checkGlow);
  const focusRings: Mesh[] = [];
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
  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function fly(b: Body, to: Vector3, q1: Quaternion, opts: { arc?: number; dur?: number; delay?: number; spin?: number; end?: () => void } = {}) {
    const p0 = b.pos.clone();
    const dist = p0.distanceTo(to);
    const arc = opts.arc ?? 0.45 + dist * 0.08;
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

  function place(b: Body, sq: Sq) {
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
    b.sq = null;
    b.mode = 'off';
    b.flight = null;
    b.group.visible = false;
  }

  /** A taken piece rests on its side on the felt beside the board, as at a real table. */
  function lie(b: Body, slot: Vector3) {
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

  let current = new Map<Sq, Placed>();
  let takenCount = 0;

  function setPosition(fen: string, animate = true) {
    const next = readFen(fen);
    const plan = planMoves(current, next);
    current = next;
    choose(null);
    for (const s of plan.stay) {
      const b = bySq.get(s);
      if (b && b.mode === 'carry') {
        b.mode = 'rest';
        b.target.copy(square(s));
      }
    }
    const go = animate && motionOn && visible;
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
      for (const b of taken) lie(b, outside(b.side, lyingCount(b.side), b.kind));
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
        if (kind) setShape(b, kind);
        return;
      }
      fly(b, dest, upright, {
        delay: i * 0.05,
        end: () => {
          b.mode = 'rest';
          b.target.copy(dest);
          b.vel.set(0, -1.3, 0);
          if (kind) setShape(b, kind);
        },
      });
      longest = Math.max(longest, b.flight!.dur + b.flight!.delay);
    });
    taken.forEach((b) => {
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
    for (const b of bodies) {
      if (b.mode === 'off') continue;
      if (b.mode === 'flight' && b.flight) {
        const f = b.flight;
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
      if (!still) moving = true;
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
  function fit() {
    const r = o.host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
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
    camera.fov = lens.at.fov;
    camera.aspect = W / H;
    camera.setViewOffset(W, H, lens.at.ox, lens.at.oy, W, H);
    camera.updateProjectionMatrix();
  }
  function placeCamera(refit: boolean) {
    const rig = rigFor(az, el, preset().dist);
    camera.position.set(...rig.camera);
    camera.lookAt(...rig.target);
    if (refit) {
      // the board sits in the part of the table the broadcast graphics leave free (CSS --inset-*)
      const cs = getComputedStyle(o.host);
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const px = (n: string) => {
        const v = cs.getPropertyValue(n).trim();
        return (parseFloat(v) || 0) * (v.endsWith('rem') ? rem : 1);
      };
      const box = { x: px('--inset-left'), y: px('--inset-top'), w: W - px('--inset-left') - px('--inset-right'), h: H - px('--inset-top') - px('--inset-bottom') };
      const f = frameBounds(boardBounds(rigFor(azimuthFor(), elevation, preset().dist)), W, H, box.w > 50 && box.h > 50 ? box : undefined);
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
    lastMat.color.copy(accent);
    ringMat.color.copy(accent);
    glowMat.color.copy(accent);
    for (const a of arrows) {
      a.mat.uniforms.uColor.value.copy(accent);
      if (a.badge) ((a.badge.children[0] as Mesh).material as MeshBasicMaterial).color.copy(accent);
    }
    hemi.intensity = STUDIO.hemi;
    key.intensity = STUDIO.lamp;
    renderer.toneMappingExposure = STUDIO.exposure;
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

  function render() {
    if (shadowsStale || dirty) {
      renderer.shadowMap.needsUpdate = true;
      shadowsStale = false;
    }
    renderer.render(scene, camera);
    dirty = false;
  }

  // warm every program the board will use (the pieces of both colours, marks, an arrow) before the first move
  {
    const warm = [makeBody('w', 'q'), makeBody('b', 'n')];
    drawArrows([{ from: 'e2', to: 'e4', label: '1' }, { from: 'g1', to: 'f3' }]);
    dots[0].visible = true;
    lastTiles[0].visible = true;
    checkGlow.visible = true;
    warm.forEach((b) => place(b, 'd4'));
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
  let swayX = 0;
  let swayVX = 0;
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
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) moving = step(dt / n) || moving;
    if (moving) shadowsStale = true;

    // arrows draw on from the tail; the numbers land when the line is drawn
    if (arrows.length && arrowClock < 1) {
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
    }
    // a slow swing round the table (the home page), or a lean toward a mouse pointer (never on touch)
    if (motionOn && orbitSpeed) {
      orbitT += orbitSpeed * dt;
      az = azimuthFor() + Math.sin(orbitT) * 0.32;
      placeCamera(false);
      moving = true;
    } else if (motionOn && window.matchMedia('(hover: hover)').matches) {
      let tx = 0;
      if (pointer && !down) {
        const r = o.host.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, ((pointer.x - r.left) / r.width) * 2 - 1));
      }
      swayVX += (40 * (tx - swayX) - 12 * swayVX) * dt;
      swayX += swayVX * dt;
      const nAz = azimuthFor() - swayX * 0.03;
      if (Math.abs(nAz - az) > 1e-5) {
        az = nAz;
        placeCamera(false);
        moving = true;
      }
    }

    if (moving || dirty) {
      render();
      frames++;
      if (seconds > 1 / 40) slow++;
      if (frames === 45) {
        if (slow > 15 && dpr > 1) {
          dpr = Math.max(1, dpr - 0.5);
          renderer.setPixelRatio(dpr);
          fit();
        }
        frames = 0;
        slow = 0;
      }
    }
  }

  function setMotion(on: boolean) {
    motionOn = on;
    if (!on) {
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
        v.copy(b.pos).add(new Vector3(0, HEIGHT[b.kind] * 0.45, 0)).project(camera);
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
      },
      state: () => ({ chosen: chosen?.sq ?? null, busy: view.busy, pieces: [...bySq.entries()].map(([s, b]) => `${b.side}${b.kind}${s}`).sort() }),
      shadows: () => (vsm ? 'vsm' : 'pcf'),
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
      return bodies.some((b) => b.mode === 'flight' || b.mode === 'carry' || b.vel.lengthSq() > 1e-4);
    },
    setInteractive(on: boolean) {
      interactive = on;
      if (!on) choose(null);
    },
    dispose() {
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
      numbers.forEach((t) => t.dispose());
      inlayMap?.dispose();
      studios.forEach((m) => m.dispose());
      renderer.dispose();
      canvas.remove();
      plate.remove();
    },
  };
  void cursor;
  return view;
}
