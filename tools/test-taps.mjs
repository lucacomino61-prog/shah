// Real taps on the boards in headless Chrome (phone profile): the 3D board on /luaj/ (piece, then square; and a
// drag), and the flat board on /ushtrime/. node tools/test-taps.mjs [base]
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://127.0.0.1:3770';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, label, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  userDataDir: join(process.env.TEMP || '.', 'shah-chrome-taps'),
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

// 3D: tap e2, tap e4
await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready' && window.__board, { timeout: 30000 });
await sleep(1500);
const at = (sq) => page.evaluate((s) => window.__board.square(s), sq);
const piece = (sq) => page.evaluate((s) => window.__board.piece(s), sq);
let p = await piece('e2');
await page.touchscreen.tap(p.x, p.y);
await sleep(300);
ok((await page.evaluate(() => window.__board.state().chosen)) === 'e2', 'tap on the e2 pawn chooses it');
let s = await at('e4');
await page.touchscreen.tap(s.x, s.y);
await page.waitForFunction(() => window.__play.state().sans.length >= 1, { timeout: 5000 }).catch(() => {});
ok((await page.evaluate(() => window.__play.state().sans[0])) === 'e4', 'tap on e4 plays e4');
await page.waitForFunction(() => window.__play.state().phase === 'user' && window.__play.state().sans.length === 2, { timeout: 30000 });
await sleep(800);
// drag the g1 knight to f3 with the mouse
p = await piece('g1');
s = await at('f3');
await page.mouse.move(p.x, p.y);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(p.x + ((s.x - p.x) * i) / 8, p.y + ((s.y - p.y) * i) / 8);
await sleep(200);
await page.mouse.up();
await page.waitForFunction(() => window.__play.state().sans.length >= 3, { timeout: 5000 }).catch(() => {});
ok((await page.evaluate(() => window.__play.state().sans[2])) === 'Nf3', 'dragging the knight plays Nf3');
// the coach graded both moves
await page.waitForFunction(() => window.__play.state().verdicts[2], { timeout: 30000 }).catch(() => {});
const v = await page.evaluate(() => window.__play.state().verdicts);
ok(!!v[0] && !!v[2], 'both moves graded', JSON.stringify([v[0]?.grade, v[2]?.grade]));

// 2D: the puzzle board answers taps
await page.goto(base + '/ushtrime/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__puzzle && window.__puzzle.state().next && !document.querySelector('[data-status]').textContent.includes('lëviz…'), { timeout: 20000 });
await sleep(600);
const next = await page.evaluate(() => window.__puzzle.state().next);
const rect = async (sq) =>
  page.evaluate((sq) => {
    const svg = document.querySelector('.board-svg');
    const r = svg.getBoundingClientRect();
    const side = window.__puzzle.state().side;
    const f = 'abcdefgh'.indexOf(sq[0]);
    const rk = Number(sq[1]) - 1;
    const size = Math.min(r.width, r.height);
    const k = size / 888;
    const x0 = r.left + (r.width - size) / 2 + 44 * k;
    const y0 = r.top + (r.height - size) / 2 + 44 * k;
    const cx = side === 'w' ? f : 7 - f;
    const cy = side === 'w' ? 7 - rk : rk;
    return { x: x0 + (cx + 0.5) * 100 * k, y: y0 + (cy + 0.5) * 100 * k };
  }, sq);
const a = await rect(next.slice(0, 2));
await page.touchscreen.tap(a.x, a.y);
await sleep(250);
const b = await rect(next.slice(2, 4));
await page.touchscreen.tap(b.x, b.y);
await sleep(1500);
const st = await page.evaluate(() => window.__puzzle.state());
ok(st.step > 1 && !st.failed, 'the right move on the flat board is accepted', `step ${st.step}`);

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nall taps work');
process.exit(failed ? 1 : 0);
