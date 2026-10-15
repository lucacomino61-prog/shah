// The nine opponents' oil portraits, cut for the web: a 4:5 card (the player deck) and a square face (the seat at
// the table, the chat, the records). The sources are invented people painted by GPT Image 2.5 through Higgsfield on
// 2026-10-15 (prompts in docs/ASSETS.md); each output carries that origin in its EXIF description.
//   node tools/bot-portraits.mjs <folder with 0-lea.png … 8-stockfish.png>
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('usage: node tools/bot-portraits.mjs <folder>');
const out = new URL('../public/bots/', import.meta.url);
mkdirSync(out, { recursive: true });
const origin = 'Shah opponent portrait. An invented person (no real model), oil-painting style, generated with GPT Image 2.5 via Higgsfield on 2026-10-15 for Shah.';

// where each face sits in its painting (centre x, centre y as fractions), for the square cut
const FACE = { lea: [0.53, 0.37], ermali: [0.55, 0.35], arta: [0.46, 0.35], agimi: [0.5, 0.31], drita: [0.53, 0.33], besniku: [0.5, 0.33], teuta: [0.48, 0.39], ardiani: [0.47, 0.32], stockfish: [0.52, 0.28] };

for (const file of readdirSync(src).filter((f) => /^\d-[a-z]+\.png$/.test(f)).sort()) {
  const id = file.slice(2, -4);
  const img = sharp(`${src}/${file}`);
  const { width: w, height: h } = await img.metadata();
  const exif = { IFD0: { ImageDescription: origin, Copyright: 'Shah (GPL-3.0); generated image' } };
  for (const cw of [320, 560]) {
    await sharp(`${src}/${file}`).resize(cw, Math.round(cw * 1.25)).webp({ quality: 80 }).withExif(exif).toFile(new URL(`${id}-${cw}.webp`, out).pathname.slice(1));
  }
  // the face: a square about half the painting's width, centred on the face
  const [fx, fy] = FACE[id] ?? [0.5, 0.3];
  const side = Math.round(w * 0.6);
  const left = Math.max(0, Math.min(w - side, Math.round(fx * w - side / 2)));
  const top = Math.max(0, Math.min(h - side, Math.round(fy * h - side * 0.5)));
  await sharp(`${src}/${file}`).extract({ left, top, width: side, height: side }).resize(192, 192).webp({ quality: 82 }).withExif(exif).toFile(new URL(`${id}-face.webp`, out).pathname.slice(1));
  console.log(id, w, h);
}
