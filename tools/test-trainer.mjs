// The opening trainer and the endgame play-out in headless Chrome. node tools/test-trainer.mjs [base]
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
  userDataDir: join(process.env.TEMP || '.', 'shah-chrome-trainer'),
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// a whole Sicilian line played right, as black
await page.goto(base + '/mesime/hapje/siciliania/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__trainer && window.__trainer.state().next, { timeout: 15000 });
let guard = 0;
while (guard++ < 30) {
  await page.waitForFunction(() => {
    const s = window.__trainer.state();
    return s.done || s.fen.split(' ')[1] === 'b';
  }, { timeout: 15000 });
  const s = await page.evaluate(() => window.__trainer.state());
  if (s.done) break;
  await sleep(500);
  await page.evaluate((u) => window.__trainer.move(u.slice(0, 2), u.slice(2, 4)), s.next);
  await sleep(400);
}
const end = await page.evaluate(() => window.__trainer.state());
ok(end.done && end.errors === 0, 'a repertoire line played right ends clean', `errors ${end.errors}`);
const title = await page.$eval('[data-title]', (e) => e.textContent);
ok(title.includes('1 nga 3'), 'the clean run is counted', title);

// a wrong move is shown and taken back
await page.click('[data-again]');
await page.waitForFunction(() => window.__trainer.state().fen.split(' ')[1] === 'b' && !window.__trainer.state().done, { timeout: 15000 });
await sleep(500);
const before = await page.evaluate(() => window.__trainer.state());
await page.evaluate(() => window.__trainer.move('h7', 'h6'));
await sleep(1500);
const afterWrong = await page.evaluate(() => window.__trainer.state());
ok(afterWrong.errors === 1 && afterWrong.fen === before.fen, 'a wrong move is counted and taken back');

// the endgame play-out: the queen mate starts and the engine answers
await page.goto(base + '/mesime/fundloja/', { waitUntil: 'networkidle0' });
await sleep(1200);
const task = await page.$eval('[data-task]', (e) => e.textContent);
ok(task.includes('motorit'), 'the play-out step says it is against the engine', task);
await page.evaluate(() => document.querySelector('[data-board]').focus());
// play Qd1-d3 (a safe squeeze) by taps on the 3D board, where its test hook says each square is on screen
await page.waitForFunction(() => window.__board, { timeout: 20000 });
await sleep(800);
const sq = async (s) => page.evaluate((x) => window.__board.square(x), s);
let a = await sq('d1');
await page.touchscreen.tap(a.x, a.y);
await sleep(200);
a = await sq('d3');
await page.touchscreen.tap(a.x, a.y);
await sleep(4000);
const t2 = await page.$eval('[data-task]', (e) => e.textContent);
ok(/mat në \d+/.test(t2) || t2.includes('Vazhdo'), 'the engine answered and the coach reports the mate distance', t2);

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\ntrainer and play-out work');
process.exit(failed ? 1 : 0);
