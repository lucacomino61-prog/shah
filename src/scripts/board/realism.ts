// The real-world look of the 3D table, from Poly Haven (all CC0, built into public/realism by
// tools/build-realism.mjs): maple and walnut veneer for the squares, each square its own leaf of the photograph;
// mahogany for the frame and the case; velvet for the case lining; and the chosen room (looks.ts): its photograph for
// the light, the reflections and the blurred background, and the wood of its table. The pieces are the Staunton set
// of staunton.ts, coloured in the shader by the chosen set: boxwood and ebony (the wood photograph projected along
// the piece's axis, so the grain runs up it as on a lathe-turned piece), lacquer, glass or metal.
// Loaded before the board is built; if any of it fails, the board keeps its drawn textures and turned pieces.

import {
  BufferAttribute,
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  MeshPhysicalMaterial,
  NoColorSpace,
  PMREMGenerator,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector2,
  type BufferGeometry,
  type DataTexture,
  type WebGLRenderer,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { WORLDS, type PieceSetId, type TableWood, type WorldId } from './looks.ts';
import { parseKnight, stauntonSet, type PieceShape } from './staunton.ts';
import type { Kind } from './types.ts';

export type { PieceShape } from './staunton.ts';

const BASE = '/realism/';

/** A room: its photograph and the wood of its table (colour, and roughness that also serves as a fine bump). */
export interface Room {
  world: WorldId;
  hdr: DataTexture;
  table: HTMLImageElement;
  tableR: HTMLImageElement;
}

export interface Realism {
  maple: HTMLImageElement;
  mapleR: HTMLImageElement;
  walnut: HTMLImageElement;
  walnutR: HTMLImageElement;
  mahogany: HTMLImageElement;
  mahoganyR: HTMLImageElement;
  /** the luxury board: dark squares, frame and case */
  rosewood: HTMLImageElement;
  rosewoodR: HTMLImageElement;
  velvet: HTMLImageElement;
  velvetN: HTMLImageElement;
  pieces: Record<Kind, PieceShape>;
  /** the coarse stand-in of each piece that the shadow map draws */
  shadows: Record<Kind, BufferGeometry>;
  room: Room;
}

const image = (name: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error(name));
    i.src = BASE + name;
  });

const WOOD_FILES: Record<TableWood, [string, string]> = {
  cherry: ['cherry.webp', 'cherry-r.webp'],
  oak: ['oak.webp', 'oak-r.webp'],
  smoked: ['smoked.webp', 'smoked-r.webp'],
  mahogany: ['mahogany.webp', 'mahogany-r.webp'],
};

/** A room's files: its photograph and its table. */
export async function loadRoom(world: WorldId): Promise<Room> {
  const [a, b] = WOOD_FILES[WORLDS[world].table.wood];
  const [hdr, table, tableR] = await Promise.all([new HDRLoader().loadAsync(`${BASE}rooms/${world}.hdr`), image(a), image(b)]);
  return { world, hdr: hdr as DataTexture, table, tableR };
}

export async function loadRealism(world: WorldId): Promise<Realism | null> {
  try {
    const bin = (name: string) =>
      fetch(BASE + name).then((r) => {
        if (!r.ok) throw new Error(name);
        return r.arrayBuffer();
      });
    const [maple, mapleR, walnut, walnutR, mahogany, mahoganyR, rosewood, rosewoodR, velvet, velvetN, knight, knightLo, room] = await Promise.all([
      image('maple.webp'),
      image('maple-r.webp'),
      image('walnut.webp'),
      image('walnut-r.webp'),
      image('mahogany.webp'),
      image('mahogany-r.webp'),
      image('rosewood.webp'),
      image('rosewood-r.webp'),
      image('velvet.webp'),
      image('velvet-n.webp'),
      bin('knight.bin'),
      bin('knight-lo.bin'),
      loadRoom(world),
    ]);
    const set = stauntonSet(parseKnight(knight), parseKnight(knightLo));
    return { maple, mapleR, walnut, walnutR, mahogany, mahoganyR, rosewood, rosewoodR, velvet, velvetN, pieces: set.pieces, shadows: set.shadows, room };
  } catch {
    return null;
  }
}

/** The room as a prefiltered environment: the soft light from all round, the reflections, and the background. */
export function roomLight(renderer: WebGLRenderer, room: Room): Texture {
  room.hdr.mapping = EquirectangularReflectionMapping;
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(room.hdr).texture;
  pmrem.dispose();
  return env;
}

/** How bright a light in the room's photograph may look in the lacquer (see noGlare); one uniform shared by every
 *  lacquered material, so a single value holds the whole board. */
export const GLARE = { uGlareCap: { value: 0.035 } };

/**
 * A lacquered finish that shows the room but not its lights (Luca, 2026-10-13: "make the light to not reflect on the
 * board"; 2026-10-15, of the night room: "fix the light reflecting on the board in natën"). The lamp's own highlight
 * on the coat and in the wood is turned down to `keep`. The room's reflection stays, but a bright light in its
 * photograph (the restaurant's lamps at night, a window by day) is compressed toward `GLARE.uGlareCap`, so it shows as
 * a soft glow of the room and never as a shining spot.
 */
export function noGlare<T extends MeshPhysicalMaterial>(m: T, keep = 0.1): T {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev?.call(m, shader, renderer);
    shader.uniforms.uGlareCap = GLARE.uGlareCap;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlareCap;\nvec3 glareHold(vec3 c) { return c / (1.0 + max(c.r, max(c.g, c.b)) / uGlareCap); }')
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
      reflectedLight.directSpecular *= ${keep.toFixed(3)};
      reflectedLight.indirectSpecular = glareHold(reflectedLight.indirectSpecular);
      #ifdef USE_CLEARCOAT
        clearcoatSpecularDirect *= ${keep.toFixed(3)};
        clearcoatSpecularIndirect = glareHold(clearcoatSpecularIndirect);
      #endif`,
      );
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${key()}-noglare${keep}`;
  return m;
}

/** A photograph as a repeating texture. `gltf`: a map baked for a glTF model, whose UVs start at the top. */
export function photo(img: HTMLImageElement, colour: boolean, anisotropy: number, gltf = false): Texture {
  const t = new Texture(img);
  t.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.flipY = !gltf;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

/**
 * The 64 squares as an inlaid board: every square its own leaf of veneer, cut from anywhere in the photograph (the
 * grain along the rank), a shade apart from its neighbours; light squares maple, dark squares walnut stained deep;
 * a fine dark line where two leaves meet. Colour at `size`, roughness (which also serves as a fine bump) at half.
 */
export function squareMaps(r: Realism, size: number): { map: CanvasTexture; rough: CanvasTexture } {
  const col = document.createElement('canvas');
  col.width = col.height = size;
  const g = col.getContext('2d')!;
  const rc = document.createElement('canvas');
  rc.width = rc.height = size / 2;
  const gr = rc.getContext('2d')!;
  let seed = 23;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const cell = size / 8;
  const rcell = cell / 2;
  for (let rank = 0; rank < 8; rank++)
    for (let file = 0; file < 8; file++) {
      const light = (file + rank) % 2 === 1;
      const img = light ? r.maple : r.rosewood;
      const rimg = light ? r.mapleR : r.rosewoodR;
      const x = file * cell;
      const y = (7 - rank) * cell;
      // a leaf about a third of the photograph wide: several grain lines to a square, never two squares alike
      const crop = img.width * 0.3;
      const sx = rnd() * (img.width - crop);
      const sy = rnd() * (img.height - crop);
      g.drawImage(img, sx, sy, crop, crop, x, y, cell, cell);
      g.globalCompositeOperation = 'multiply';
      const v = 0.93 + rnd() * 0.1;
      // maple to the honey of a lacquered board; rosewood a shade deeper, its red and its figure kept
      g.fillStyle = light ? `rgb(${(236 * v) | 0},${(212 * v) | 0},${(174 * v) | 0})` : `rgb(${(196 * v) | 0},${(150 * v) | 0},${(132 * v) | 0})`;
      g.fillRect(x, y, cell, cell);
      g.globalCompositeOperation = 'source-over';
      const rs = rimg.width * 0.3;
      gr.drawImage(rimg, (sx / img.width) * rimg.width, (sy / img.height) * rimg.height, rs, rs, file * rcell, (7 - rank) * rcell, rcell, rcell);
    }
  // where two leaves meet: a hairline in the colour, a rougher line in the finish
  g.strokeStyle = 'rgba(28,14,6,0.55)';
  g.lineWidth = Math.max(1, size / 1400);
  gr.strokeStyle = 'rgba(255,255,255,0.6)';
  gr.lineWidth = Math.max(1, size / 2800);
  for (let i = 1; i < 8; i++) {
    for (const [ctx, c, s] of [
      [g, cell, size],
      [gr, rcell, size / 2],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(i * c, 0);
      ctx.lineTo(i * c, s);
      ctx.moveTo(0, i * c);
      ctx.lineTo(s, i * c);
      ctx.stroke();
    }
  }
  const map = new CanvasTexture(col);
  map.colorSpace = SRGBColorSpace;
  const rough = new CanvasTexture(rc);
  rough.colorSpace = NoColorSpace;
  return { map, rough };
}

/**
 * Box-projected UVs for wood on a box-like part (frame, case walls): each face takes the two axes it spans, so the
 * grain runs along every long edge and keeps its scale whatever the part's size. `unit` is board units per repeat.
 */
export function boxUV<T extends BufferGeometry>(g: T, unit: number): T {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = pos.getX(i);
      v = pos.getZ(i);
    } else if (nz >= nx) {
      u = pos.getX(i);
      v = pos.getY(i);
    } else {
      u = pos.getZ(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u / unit;
    uv[i * 2 + 1] = v / unit;
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}

interface Finish {
  tint: [number, number, number];
  /** how much of the wood photograph shows (1 bare wood, a little under lacquer, none in glass and metal) */
  wood: number;
  /** the photograph's contrast and brightness: maple is pale and flat, turned boxwood shows its grain */
  contrast: number;
  gain: number;
  rough: number;
  /** how much the grain breaks the gloss: the dark lines of the grain are duller than the wood between them */
  gloss: number;
  /** the grain standing a hair proud of the polish, in squares (0: a smooth lacquer or crystal) */
  relief: number;
  coat: number;
  coatRough: number;
  env: number;
  /** the soft light along the edges of waxed wood */
  sheen?: [number, [number, number, number]];
  metal?: number;
  glass?: { rough: number; tint: [number, number, number]; depth: number };
}

/** How each set is finished, White's piece and Black's (Luca, 2026-10-15: "make the pieces look more realistic"). */
const FINISH: Record<PieceSetId, Record<'w' | 'b', Finish>> = {
  // boxwood under wax: pale yellow, its grain running up the piece, a soft satin shine that the grain breaks up;
  // ebony under the same wax: almost black, brown streaks of grain in it, a satin shine (a mirror reads as plastic)
  wood: {
    w: { tint: [0.9, 0.75, 0.5], wood: 1, contrast: 1.8, gain: 1.42, rough: 0.5, gloss: 0.4, relief: 0.0026, coat: 0.3, coatRough: 0.22, env: 0.5, sheen: [0.4, [0.55, 0.45, 0.3]] },
    b: { tint: [0.1, 0.07, 0.052], wood: 1, contrast: 1.7, gain: 1.45, rough: 0.46, gloss: 0.4, relief: 0.0022, coat: 0.32, coatRough: 0.22, env: 0.42, sheen: [0.3, [0.26, 0.2, 0.15]] },
  },
  // lacquer over the wood: cream and oxblood, a deep wet shine with the grain faint under it
  lacquer: {
    w: { tint: [0.9, 0.84, 0.7], wood: 0.3, contrast: 1.4, gain: 1.25, rough: 0.32, gloss: 0, relief: 0, coat: 1, coatRough: 0.035, env: 0.62 },
    b: { tint: [0.17, 0.012, 0.011], wood: 0.3, contrast: 1.4, gain: 1.25, rough: 0.32, gloss: 0, relief: 0, coat: 1, coatRough: 0.035, env: 0.62 },
  },
  // clear crystal and frosted ruby
  glass: {
    w: { tint: [1, 1, 1], wood: 0, contrast: 1, gain: 1, rough: 0.06, gloss: 0, relief: 0, coat: 0, coatRough: 0, env: 1.35, glass: { rough: 0.06, tint: [0.95, 0.99, 0.98], depth: 2.4 } },
    b: { tint: [1, 0.92, 0.92], wood: 0, contrast: 1, gain: 1, rough: 0.2, gloss: 0, relief: 0, coat: 0, coatRough: 0, env: 1, glass: { rough: 0.2, tint: [0.62, 0.035, 0.07], depth: 0.24 } },
  },
  // polished silver and gold, with the faint streaks of the polishing running up the piece
  metal: {
    w: { tint: [0.93, 0.93, 0.95], wood: 0, contrast: 2, gain: 1.4, rough: 0.17, gloss: 0.55, relief: 0, coat: 0, coatRough: 0, env: 1, metal: 1 },
    b: { tint: [1, 0.74, 0.32], wood: 0, contrast: 2, gain: 1.4, rough: 0.2, gloss: 0.55, relief: 0, coat: 0, coatRough: 0, env: 1, metal: 1 },
  },
};

/**
 * A piece of the chosen set. Wood and lacquer take the wood photograph projected from three sides in the piece's
 * own space, its grain turned to run up the axis and blended by the surface direction (no seams, whatever the
 * shape): the colour, a gloss that the grain breaks up, and on bare wood a relief a hair high under the wax. Metal
 * takes only the streaks. In every set the hollows of the carving darken by the shape's own `ao` (more in the room's
 * light than under the lamp), and the felt pad under the base stays green baize. `grain` shifts the projection so no
 * two pieces share the same figure, and `shade` (-1 to 1) makes each a shade lighter or darker, as the pieces of a
 * real set are.
 */
export function pieceMaterial(set: PieceSetId, side: 'w' | 'b', opts: { maple: Texture; walnut: Texture; env: Texture; grain: Vector2; shade?: number }): MeshPhysicalMaterial {
  const f = FINISH[set][side];
  const m = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: f.rough,
    metalness: f.metal ?? 0,
    clearcoat: f.coat,
    clearcoatRoughness: f.coatRough,
    envMap: opts.env,
    envMapIntensity: f.env,
  });
  if (f.sheen) {
    m.sheen = f.sheen[0];
    m.sheenRoughness = 0.5;
    m.sheenColor = new Color(...f.sheen[1]);
  }
  if (f.glass) {
    m.transmission = 1;
    m.thickness = 0.5;
    m.ior = 1.5;
    m.roughness = f.glass.rough;
    m.attenuationColor = new Color(...f.glass.tint);
    m.attenuationDistance = f.glass.depth;
    m.specularIntensity = 1;
  }
  const grain = f.wood > 0 || f.gloss > 0;
  const felt = !f.glass;
  const relief = f.relief > 0;
  // added to the material's own STANDARD and PHYSICAL
  m.defines = { ...m.defines, ...(grain ? { GRAIN: '' } : {}), ...(felt ? { FELT: '' } : {}), ...(relief ? { RELIEF: '' } : {}) };
  const shade = 1 + 0.06 * (opts.shade ?? 0);
  const uniforms = {
    uWood: { value: side === 'w' ? opts.maple : opts.walnut },
    uTint: { value: new Color(...f.tint).multiplyScalar(shade) },
    uWoodMix: { value: f.wood },
    uContrast: { value: f.contrast },
    uGain: { value: f.gain },
    uGloss: { value: f.gloss },
    uRelief: { value: f.relief },
    uGrain: { value: opts.grain },
    uFelt: { value: new Color(0x21402e) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float ao;\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;\nvarying float vAo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\nvObjNormal = normal;\nvAo = ao;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNormal;\nvarying float vAo;\nuniform sampler2D uWood;\nuniform vec3 uTint;\nuniform float uWoodMix;\nuniform float uContrast;\nuniform float uGain;\nuniform float uGloss;\nuniform float uRelief;\nuniform vec2 uGrain;\nuniform vec3 uFelt;',
      )
      .replace(
        '#include <map_fragment>',
        `
        vec3 base = uTint;
        // the height of the grain, 0 in its dark lines to 1 between them
        float woodH = 0.5;
        #ifdef GRAIN
          // the photograph from three sides, its grain (along the picture's width) turned to run up the piece
          vec3 wn = abs(normalize(vObjNormal));
          wn = pow(wn, vec3(4.0));
          wn /= (wn.x + wn.y + wn.z);
          const float WOOD_SCALE = 0.22;
          vec3 wx = texture2D(uWood, vec2(vObjPos.y, vObjPos.z) * WOOD_SCALE + uGrain).rgb;
          vec3 wz = texture2D(uWood, vec2(vObjPos.y, vObjPos.x) * WOOD_SCALE + uGrain.yx).rgb;
          vec3 wy = texture2D(uWood, vObjPos.xz * WOOD_SCALE + uGrain * 1.7).rgb;
          vec3 w = pow(wx * wn.x + wy * wn.y + wz * wn.z, vec3(uContrast)) * uGain;
          woodH = clamp(dot(w, vec3(0.333)) / uGain * 1.6 - 0.3, 0.0, 1.0);
          base = mix(uTint, w * uTint, uWoodMix);
        #endif
        float feltPad = 0.0;
        #ifdef FELT
          // the felt pad glued under the base
          feltPad = step(vObjNormal.y, -0.6) * step(vObjPos.y, 0.03);
        #endif
        diffuseColor.rgb *= mix(base, uFelt, feltPad);
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        // the grain's dark lines hold less shine than the wood between them, so the highlight breaks along the grain
        roughnessFactor = clamp(roughnessFactor * (1.0 + uGloss * (0.5 - woodH) * 2.0), 0.04, 1.0);
        roughnessFactor = mix(roughnessFactor, 1.0, feltPad);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        #ifdef RELIEF
        {
          // the grain a hair proud of the wax: a bump from its height, measured across the pixel
          vec3 dpdx = dFdx(-vViewPosition);
          vec3 dpdy = dFdy(-vViewPosition);
          float hx = dFdx(woodH) * uRelief;
          float hy = dFdy(woodH) * uRelief;
          vec3 r1 = cross(dpdy, normal);
          vec3 r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          vec3 grad = sign(det) * (hx * r1 + hy * r2);
          normal = normalize(abs(det) * normal - grad);
        }
        #endif`,
      )
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - feltPad;')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - feltPad;\n#endif')
      .replace(
        '#include <aomap_fragment>',
        `
        // the hollows of the carving: the room's light reaches them less, the lamp a little less
        float ambientOcclusion = vAo;
        reflectedLight.indirectDiffuse *= ambientOcclusion;
        reflectedLight.directDiffuse *= mix(1.0, ambientOcclusion, 0.45);
        #if defined( USE_CLEARCOAT )
          clearcoatSpecularIndirect *= ambientOcclusion;
        #endif
        #if defined( USE_SHEEN )
          sheenSpecularIndirect *= ambientOcclusion;
        #endif
        #if defined( USE_ENVMAP ) && defined( STANDARD )
          float dotNVao = saturate( dot( geometryNormal, geometryViewDir ) );
          reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNVao, ambientOcclusion, material.roughness );
        #endif
        `,
      );
  };
  m.customProgramCacheKey = () => `shah-piece-${grain ? 1 : 0}${felt ? 1 : 0}${relief ? 1 : 0}`;
  return m;
}
