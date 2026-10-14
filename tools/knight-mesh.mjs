// The carved knight: a high-detail mesh lifted from a photograph of a boxwood Staunton knight (Higgsfield: GPT Image
// for the picture, Hunyuan3D v3 for the geometry, 2026-10-14), cut down to a size a phone draws easily and written
// as public/realism/knight.bin for src/scripts/board/staunton.ts.
//
//   node tools/knight-mesh.mjs <knight.glb> [triangles=18000] [yawDegrees=0]
//
// Steps: read the GLB's triangles, weld the vertices, simplify with meshoptimizer, stand it on y = 0 with its turned
// base centred on the axis, scale it to HEIGHT squares (yaw 0 leaves the head looking along -x), bake an occlusion
// term into each vertex (how much of the surface round it closes over it: the mane's grooves, the eyes, the cove of
// the base), and store positions as 16-bit fractions of the bounding box, normals and occlusion as bytes and the
// triangles as 16-bit indices.
// Format: uint32 header length, JSON header { count, indexCount, min, max, height, girth }, then int16 positions,
// int8 normals (padded to 4 bytes), uint16 indices (padded to 4 bytes) and uint8 occlusion (1 = open).

import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';

const [, , file, trisArg = '18000', yawArg = '0'] = process.argv;
if (!file) {
  console.error('usage: node tools/knight-mesh.mjs <knight.glb> [triangles] [yawDegrees]');
  process.exit(1);
}
/** the knight's height and base radius, in squares (a tournament Staunton: 2.9 in on 2.25 in squares) */
const HEIGHT = 1.28;
const OUT = new URL('../public/realism/knight.bin', import.meta.url);

// ---------------------------------------------------------------- GLB
const glb = readFileSync(file);
if (glb.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
let off = 12;
let json = null;
let bin = null;
while (off < glb.length) {
  const len = glb.readUInt32LE(off);
  const type = glb.readUInt32LE(off + 4);
  const body = glb.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(body.toString('utf8'));
  else if (type === 0x004e4942) bin = body;
  off += 8 + len;
}
const accessor = (i) => {
  const a = json.accessors[i];
  const v = json.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const C = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const stride = v.byteStride ?? comps * C.BYTES_PER_ELEMENT;
  const out = new C(a.count * comps);
  for (let k = 0; k < a.count; k++) {
    const src = new C(bin.buffer, bin.byteOffset + start + k * stride, comps);
    out.set(src, k * comps);
  }
  return out;
};
const pos = [];
const idx = [];
for (const mesh of json.meshes)
  for (const prim of mesh.primitives) {
    const p = accessor(prim.attributes.POSITION);
    const base = pos.length / 3;
    for (const x of p) pos.push(x);
    const ind = prim.indices !== undefined ? accessor(prim.indices) : Uint32Array.from({ length: p.length / 3 }, (_, i) => i);
    for (const i of ind) idx.push(i + base);
  }
console.log('source', pos.length / 3, 'vertices', idx.length / 3, 'triangles');

// ---------------------------------------------------------------- weld and simplify
await MeshoptSimplifier.ready;
const positions = Float32Array.from(pos);
const remap = MeshoptSimplifier.generatePositionRemap(positions, 3);
const welded = Uint32Array.from(idx, (i) => remap[i]);
const target = Number(trisArg) * 3;
const [simple, err] = MeshoptSimplifier.simplify(welded, positions, 3, target, 0.02, ['Prune']);
console.log('simplified to', simple.length / 3, 'triangles, error', err.toFixed(5));

// compact: only the vertices the simplified triangles use
const used = new Map();
const verts = [];
const tris = new Uint32Array(simple.length);
for (let i = 0; i < simple.length; i++) {
  let n = used.get(simple[i]);
  if (n === undefined) {
    n = verts.length / 3;
    used.set(simple[i], n);
    verts.push(positions[simple[i] * 3], positions[simple[i] * 3 + 1], positions[simple[i] * 3 + 2]);
  }
  tris[i] = n;
}
const count = verts.length / 3;
if (count > 65535) throw new Error('too many vertices for 16-bit indices');

// ---------------------------------------------------------------- stand it up
let minY = Infinity;
let maxY = -Infinity;
for (let i = 0; i < count; i++) {
  minY = Math.min(minY, verts[i * 3 + 1]);
  maxY = Math.max(maxY, verts[i * 3 + 1]);
}
const h0 = maxY - minY;
// the turned base: the centre of the vertices in the bottom tenth is the axis
let cx = 0;
let cz = 0;
let nb = 0;
for (let i = 0; i < count; i++)
  if (verts[i * 3 + 1] < minY + h0 * 0.1) {
    cx += verts[i * 3];
    cz += verts[i * 3 + 2];
    nb++;
  }
cx /= nb;
cz /= nb;
const s = HEIGHT / h0;
const yaw = (Number(yawArg) * Math.PI) / 180;
const cy = Math.cos(yaw);
const sy = Math.sin(yaw);
let girth = 0;
for (let i = 0; i < count; i++) {
  const x = (verts[i * 3] - cx) * s;
  const z = (verts[i * 3 + 2] - cz) * s;
  verts[i * 3] = x * cy + z * sy;
  verts[i * 3 + 1] = (verts[i * 3 + 1] - minY) * s;
  verts[i * 3 + 2] = -x * sy + z * cy;
  girth = Math.max(girth, Math.hypot(verts[i * 3], verts[i * 3 + 2]));
}

// ---------------------------------------------------------------- smooth normals (area weighted)
const nor = new Float32Array(count * 3);
for (let t = 0; t < tris.length; t += 3) {
  const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]];
  const ux = verts[b * 3] - verts[a * 3];
  const uy = verts[b * 3 + 1] - verts[a * 3 + 1];
  const uz = verts[b * 3 + 2] - verts[a * 3 + 2];
  const vx = verts[c * 3] - verts[a * 3];
  const vy = verts[c * 3 + 1] - verts[a * 3 + 1];
  const vz = verts[c * 3 + 2] - verts[a * 3 + 2];
  const nx = uy * vz - uz * vy;
  const ny = uz * vx - ux * vz;
  const nz = ux * vy - uy * vx;
  for (const k of [a, b, c]) {
    nor[k * 3] += nx;
    nor[k * 3 + 1] += ny;
    nor[k * 3 + 2] += nz;
  }
}

// ---------------------------------------------------------------- occlusion
// for each vertex, the surface within RADIUS that rises over it (in front of its normal), weighted by nearness
const RADIUS = 0.06;
const cell = (v) => Math.floor(v / RADIUS);
const grid = new Map();
for (let i = 0; i < count; i++) {
  const key = `${cell(verts[i * 3])},${cell(verts[i * 3 + 1])},${cell(verts[i * 3 + 2])}`;
  let list = grid.get(key);
  if (!list) grid.set(key, (list = []));
  list.push(i);
}
const occ = new Float32Array(count);
for (let i = 0; i < count; i++) {
  const px = verts[i * 3];
  const py = verts[i * 3 + 1];
  const pz = verts[i * 3 + 2];
  const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1;
  const nx = nor[i * 3] / l;
  const ny = nor[i * 3 + 1] / l;
  const nz = nor[i * 3 + 2] / l;
  let sum = 0;
  let wsum = 0;
  const [gx, gy, gz] = [cell(px), cell(py), cell(pz)];
  for (let a = -1; a <= 1; a++)
    for (let b = -1; b <= 1; b++)
      for (let c = -1; c <= 1; c++) {
        const list = grid.get(`${gx + a},${gy + b},${gz + c}`);
        if (!list) continue;
        for (const j of list) {
          if (j === i) continue;
          const dx = verts[j * 3] - px;
          const dy = verts[j * 3 + 1] - py;
          const dz = verts[j * 3 + 2] - pz;
          const d = Math.hypot(dx, dy, dz);
          if (d > RADIUS || d < 1e-6) continue;
          const w = 1 - d / RADIUS;
          sum += w * Math.max(0, (dx * nx + dy * ny + dz * nz) / d);
          wsum += w;
        }
      }
  occ[i] = wsum ? sum / wsum : 0;
}
// the floor under the base is not part of the mesh: the felt underside stays open
const ao = new Uint8Array(Math.ceil(count / 4) * 4).fill(255);
for (let i = 0; i < count; i++) ao[i] = Math.round(255 * Math.max(0.3, Math.min(1, 1 - occ[i] * 1.9)));

// ---------------------------------------------------------------- write
const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < count; i++)
  for (let k = 0; k < 3; k++) {
    min[k] = Math.min(min[k], verts[i * 3 + k]);
    max[k] = Math.max(max[k], verts[i * 3 + k]);
  }
const q = new Int16Array(count * 3);
const n8 = new Int8Array(Math.ceil((count * 3) / 4) * 4);
for (let i = 0; i < count; i++) {
  const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1;
  for (let k = 0; k < 3; k++) {
    q[i * 3 + k] = Math.round(((verts[i * 3 + k] - min[k]) / (max[k] - min[k])) * 65535 - 32768);
    n8[i * 3 + k] = Math.round((nor[i * 3 + k] / l) * 127);
  }
}
const ind16 = new Uint16Array(Math.ceil(tris.length / 2) * 2);
ind16.set(tris);
const header = Buffer.from(JSON.stringify({ count, indexCount: tris.length, min, max, height: HEIGHT, girth: Number(girth.toFixed(4)) }));
const pad = (4 - ((4 + header.length) % 4)) % 4;
const head = Buffer.alloc(4);
head.writeUInt32LE(header.length + pad);
const out = Buffer.concat([head, header, Buffer.alloc(pad, 0x20), Buffer.from(q.buffer), Buffer.from(n8.buffer), Buffer.from(ind16.buffer), Buffer.from(ao.buffer)]);
writeFileSync(OUT, out);
console.log('knight.bin', out.length, 'bytes;', count, 'vertices,', tris.length / 3, 'triangles; girth', girth.toFixed(3), 'base axis at', cx.toFixed(3), cz.toFixed(3));
