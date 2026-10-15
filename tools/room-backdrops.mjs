// The reading pages (Mësime, Progresi) sit in the same room as the board: a still photograph of the table in each
// room, taken from the live 3D scene on the home page with the interface hidden, then softened as if by the lens.
// One upright picture for phones and one wide for screens, per room. Needs the dev server (npm run dev).
//   node tools/room-backdrops.mjs
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const out = new URL('../public/rooms/', import.meta.url).pathname.slice(1);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'] });
const origin = 'Shah: the table in one of its rooms, rendered from the app\'s own three.js scene (Poly Haven CC0 HDRIs and textures).';

for (const world of ['library', 'day', 'fire', 'night']) {
  for (const [w, h, dsf, kind, outW] of [[430, 932, 2, 'tall', 720], [1600, 1000, 1, 'wide', 1600]]) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dsf });
    await page.goto('http://127.0.0.1:3770/404.html');
    await page.evaluate((t, wd) => { localStorage.clear(); localStorage.setItem('shah.unboxed', t); localStorage.setItem('shah.world', wd); localStorage.setItem('shah.motion', 'off'); localStorage.setItem('shah.welcome', 'done'); }, today, world);
    await page.goto('http://127.0.0.1:3770/', { waitUntil: 'networkidle0' }).catch(() => {});
    await page.addStyleTag({ content: '[data-board-ui], .tabs, .mast, .unbox, .stage::before, .welcome { display: none !important; }' });
    await sleep(9000);
    const shot = await page.screenshot({ type: 'png' });
    await sharp(shot).resize(outW).blur(kind === 'tall' ? 2.2 : 2.6).webp({ quality: 72 }).withExif({ IFD0: { ImageDescription: origin } }).toFile(`${out}${world}-${kind}.webp`);
    console.log(world, kind);
    await ctx.close();
  }
}
await browser.close();
