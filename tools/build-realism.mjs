// The real-world materials of the 3D table, from Poly Haven (all CC0): maple and walnut veneers for the squares,
// rosewood for the dark squares, the frame and the case (mahogany before 2026-10-15), velvet for the case lining (veneer is sanded flat: its grain comes through the
// roughness maps, which also serve as a fine bump); and for each of the four rooms (src/scripts/board/looks.ts) its
// photograph, which lights the table and shows blurred behind it, and the wood of its table: lacquered cherry by the
// fire, smoked walnut in the club library, light oak in the day room, dark wood on the night desk. The pieces are made
// in the browser (staunton.ts) and the knight comes from tools/knight-mesh.mjs. Writes public/realism/, small enough
// for a phone and the offline cache; a room's files load only when it is chosen.
//
// node tools/build-realism.mjs <polyhaven-download-dir>
// The download dir holds the 1k files as fetched from api.polyhaven.com (see README: "Realism assets").
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('usage: node tools/build-realism.mjs <polyhaven-download-dir>');
const out = 'public/realism';
mkdirSync(out, { recursive: true });
const puppeteer = createRequire(import.meta.url)('puppeteer-core');

// ------------------------------------------------------------------ images: resized and re-encoded as WebP in Chrome
const jobs = [
  // [source, output, size, quality, gray]
  ['white_maple_veneer_diff_1k.jpg', 'maple.webp', 1024, 0.82, false],
  ['white_maple_veneer_rough_1k.jpg', 'maple-r.webp', 512, 0.75, true],
  ['walnut_veneer_02_diff_1k.jpg', 'walnut.webp', 1024, 0.82, false],
  ['walnut_veneer_02_rough_1k.jpg', 'walnut-r.webp', 512, 0.75, true],
  ['dark_wood_diff_1k.jpg', 'mahogany.webp', 1024, 0.82, false],
  ['lacquered_cherry_wood_diff_1k.jpg', 'cherry.webp', 1024, 0.82, false],
  ['lacquered_cherry_wood_rough_1k.jpg', 'cherry-r.webp', 512, 0.75, true],
  ['dark_wood_rough_1k.jpg', 'mahogany-r.webp', 256, 0.75, true],
  ['velour_velvet_nor_1k.jpg', 'velvet-n.webp', 512, 0.8, false],
  ['velour_velvet_diff_1k.jpg', 'velvet.webp', 256, 0.8, false],
  // the tables of the day room and the library
  ['oak_veneer_01_diff_1k.jpg', 'oak.webp', 1024, 0.82, false],
  ['oak_veneer_01_rough_1k.jpg', 'oak-r.webp', 512, 0.75, true],
  ['smoked_walnut_veneer_diff_1k.jpg', 'smoked.webp', 1024, 0.82, false],
  ['smoked_walnut_veneer_rough_1k.jpg', 'smoked-r.webp', 512, 0.75, true],
  // the luxury board: rosewood for the dark squares, the frame and the box
  ['rosewood_veneer1_diff_1k.jpg', 'rosewood.webp', 1024, 0.84, false],
  ['rosewood_veneer1_rough_1k.jpg', 'rosewood-r.webp', 512, 0.75, true],
];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
for (const [from, to, size, q, gray] of jobs) {
  const b64 = readFileSync(join(src, from)).toString('base64');
  const data = await page.evaluate(
    async (b64, size, q, gray) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d', { colorSpace: 'srgb' });
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, size, size);
      if (gray) {
        const d = g.getImageData(0, 0, size, size);
        for (let i = 0; i < d.data.length; i += 4) {
          const v = gray === 'red' ? d.data[i] : Math.round(0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]);
          d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
        }
        g.putImageData(d, 0, 0);
      }
      return c.toDataURL('image/webp', q).split(',')[1];
    },
    b64,
    size,
    q,
    gray,
  );
  writeFileSync(join(out, to), Buffer.from(data, 'base64'));
}
await browser.close();

// ------------------------------------------------------------------ the HDRI, halved: Radiance RGBE in, RLE RGBE out
function decodeHdr(buf) {
  let pos = 0;
  const line = () => {
    let s = '';
    while (buf[pos] !== 0x0a) s += String.fromCharCode(buf[pos++]);
    pos++;
    return s;
  };
  while (line() !== '');
  const dims = line().split(' ');
  const h = Number(dims[1]);
  const w = Number(dims[3]);
  const px = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (buf[pos] === 2 && buf[pos + 1] === 2 && ((buf[pos + 2] << 8) | buf[pos + 3]) === w) {
      pos += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < w) {
          let n = buf[pos++];
          if (n > 128) {
            n -= 128;
            const v = buf[pos++];
            for (let i = 0; i < n; i++) scan[x++ * 4 + c] = v;
          } else for (let i = 0; i < n; i++) scan[x++ * 4 + c] = buf[pos++];
        }
      }
    } else {
      for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) scan[x * 4 + c] = buf[pos++];
    }
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3];
      const f = e ? Math.pow(2, e - 136) : 0;
      for (let c = 0; c < 3; c++) px[(y * w + x) * 3 + c] = scan[x * 4 + c] * f;
    }
  }
  return { w, h, px };
}
function encodeHdr({ w, h, px }) {
  const parts = [Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${h} +X ${w}\n`, 'latin1')];
  const rgbe = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = px[(y * w + x) * 3];
      const g = px[(y * w + x) * 3 + 1];
      const b = px[(y * w + x) * 3 + 2];
      const m = Math.max(r, g, b);
      if (m < 1e-32) {
        rgbe.set([0, 0, 0, 0], x * 4);
        continue;
      }
      const e = Math.ceil(Math.log2(m) + 1e-9);
      const f = Math.pow(2, -e) * 256;
      rgbe.set([Math.min(255, Math.floor(r * f)), Math.min(255, Math.floor(g * f)), Math.min(255, Math.floor(b * f)), e + 128], x * 4);
    }
    // new-style RLE, one channel after another
    const row = [2, 2, (w >> 8) & 255, w & 255];
    for (let c = 0; c < 4; c++) {
      let x = 0;
      while (x < w) {
        let run = 1;
        while (x + run < w && run < 127 && rgbe[(x + run) * 4 + c] === rgbe[x * 4 + c]) run++;
        if (run >= 3) {
          row.push(128 + run, rgbe[x * 4 + c]);
          x += run;
        } else {
          let n = 0;
          const start = x;
          while (x < w && n < 128) {
            let r2 = 1;
            while (x + r2 < w && r2 < 3 && rgbe[(x + r2) * 4 + c] === rgbe[x * 4 + c]) r2++;
            if (r2 >= 3) break;
            x++;
            n++;
          }
          row.push(n);
          for (let i = start; i < start + n; i++) row.push(rgbe[i * 4 + c]);
        }
      }
    }
    parts.push(Buffer.from(row));
  }
  return Buffer.concat(parts);
}
// the four rooms: Poly Haven HDRI name per room
const ROOMS = { library: 'billiard_hall', day: 'cayley_interior', fire: 'fireplace', night: 'warm_restaurant_night' };
mkdirSync(join(out, 'rooms'), { recursive: true });
for (const [room, name] of Object.entries(ROOMS)) {
  const hdr = decodeHdr(readFileSync(join(src, `${name}_1k.hdr`)));
  const w = hdr.w / 2;
  const h = hdr.h / 2;
  const px = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++) {
        const at = (yy, xx) => hdr.px[(yy * hdr.w + xx) * 3 + c];
        px[(y * w + x) * 3 + c] = (at(2 * y, 2 * x) + at(2 * y, 2 * x + 1) + at(2 * y + 1, 2 * x) + at(2 * y + 1, 2 * x + 1)) / 4;
      }
  writeFileSync(join(out, 'rooms', `${room}.hdr`), encodeHdr({ w, h, px }));
}

let total = 0;
for (const f of [...jobs.map((j) => j[1]), ...Object.keys(ROOMS).map((r) => `rooms/${r}.hdr`), 'knight.bin']) {
  const s = statSync(join(out, f)).size;
  total += s;
  console.log(f.padEnd(16), (s / 1024).toFixed(0).padStart(5), 'KB');
}
console.log('total', (total / 1024 / 1024).toFixed(2), 'MB');
