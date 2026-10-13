// Real taps on the boards in headless Chrome (phone profile): the 3D board on /luaj/ (piece, then square; and a
// drag), and the puzzle board on /ushtrime/. node tools/test-taps.mjs [base]
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

// a fresh game against a level that answers properly: the replay returns every piece, and a take-back restores
// the position exactly (a taken piece flies back from the felt)
await page.evaluate(() => localStorage.clear());
await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready' && window.__board, { timeout: 30000 });
await page.evaluate(() => window.__play.setLevel(5));
await sleep(800);
await page.evaluate(() => window.__play.move('e2', 'e4'));
await page.waitForFunction(() => window.__play.state().sans.length === 2 && window.__play.state().phase === 'user', { timeout: 30000 });
await sleep(1500);
const settled = () => page.waitForFunction(() => !window.__board.state().busy, { timeout: 8000 }).catch(() => {});
await settled();
const before = await page.evaluate(() => window.__board.state().pieces.join(','));
await page.evaluate(() => window.__play.move('d1', 'h5'));
await page.waitForFunction(() => window.__play.state().sans.length === 4 && window.__play.state().phase === 'user', { timeout: 30000 });
await sleep(1500);
await settled();
const game = await page.evaluate(() => window.__board.state().pieces.join(','));
await page.click('[data-why]');
await sleep(2500);
await page.click('[data-back]');
await sleep(300);
await settled();
ok((await page.evaluate(() => window.__board.state().pieces.join(','))) === game, 'after "Shiko pse" every piece is back where the game stands');
await page.evaluate(() => document.querySelector('[data-undo]').click());
await page.waitForFunction(() => window.__play.state().sans.length === 2, { timeout: 8000 }).catch(() => {});
await sleep(300);
await settled();
ok((await page.evaluate(() => window.__board.state().pieces.join(','))) === before, 'a take-back restores the position exactly');

// the intro hides once the board is ready, and its skip works at once
await page.goto(base + '/luaj/', { waitUntil: 'domcontentloaded' });
await page.click('[data-intro-skip]').catch(() => {});
await sleep(800);
ok(await page.evaluate(() => document.querySelector('[data-intro]').hidden), 'the intro closes on "Kalo"');

// the puzzle board answers taps
await page.goto(base + '/ushtrime/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__puzzle && window.__puzzle.state().next && !document.querySelector('[data-status]').textContent.includes('lëviz…'), { timeout: 20000 });
await sleep(600);
const next = await page.evaluate(() => window.__puzzle.state().next);
// the puzzle board is the 3D table too: its test hook says where each square is on screen
await page.waitForFunction(() => window.__board && !window.__board.state().busy, { timeout: 20000 });
const rect = async (sq) => page.evaluate((s) => window.__board.square(s), sq);
const a = await rect(next.slice(0, 2));
await page.touchscreen.tap(a.x, a.y);
await sleep(250);
const b = await rect(next.slice(2, 4));
await page.touchscreen.tap(b.x, b.y);
await sleep(1500);
const st = await page.evaluate(() => window.__puzzle.state());
ok(st.step > 1 && !st.failed, 'the right move on the puzzle board is accepted', `step ${st.step}`);

await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nall taps work');
process.exit(failed ? 1 : 0);
