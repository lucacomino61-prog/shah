// The learning loop end to end in headless Chrome: a timed game, a blunder, the graph, then the same blunder
// back as a puzzle on the puzzles page. node tools/test-flow.mjs [base]
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
  userDataDir: join(process.env.TEMP || '.', 'shah-chrome-flow'),
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// a 3+2 game from the setup sheet
await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready', { timeout: 30000 });
await page.evaluate(() => document.querySelector('[data-new]').click());
// the sheet rises for 460ms; choose once it has arrived
await sleep(700);
await page.click('input[name="clock"][value="3+2"]');
await page.click('input[name="level"][value="5"]');
await page.click('.setup button[type="submit"]');
await sleep(800);
const t0 = await page.$eval('[data-you] [data-clock]', (e) => e.textContent);
ok(t0 === '3:00' || t0 === '2:59', 'a 3+2 clock starts at three minutes', t0);
await page.evaluate(() => window.__play.move('e2', 'e4'));
await page.waitForFunction(() => window.__play.state().sans.length === 2 && window.__play.state().phase === 'user', { timeout: 30000 });
await sleep(2200);
const t1 = await page.$eval('[data-you] [data-clock]', (e) => e.textContent);
ok(t1 !== t0, 'the clock runs on the learner’s turn', `${t0} -> ${t1}`);
// the blunder, taken by the engine
await page.evaluate(() => window.__play.move('f1', 'a6'));
await page.waitForFunction(() => window.__play.state().sans.length === 4 && window.__play.state().phase === 'user', { timeout: 30000 });
await sleep(2500);
const card = await page.evaluate(() => JSON.parse(localStorage.getItem('shah.progress.v1')).cards);
ok(card.length === 1 && card[0].played === 'Ba6', 'the blunder is kept as a card', JSON.stringify(card.map((c) => [c.played, c.grade, c.good])));
await page.evaluate(() => (document.querySelector('[data-review-box]').open = true));
const marks = await page.$$eval('.review__mark', (l) => l.length);
const area = await page.$('.review__area');
ok(!!area && marks === 1, 'the graph draws, with one mistake marked', `marks ${marks}`);
const cap = await page.$eval('[data-review-cap]', (e) => e.textContent);
ok(cap.includes('Momenti kyç: lëvizja 2'), 'the turning point is the blunder', cap);
// the move strip over the board: every move in one line, the last one current; a tap opens that move
const strip = await page.$$eval('.strip__mv', (l) => l.map((b) => b.textContent.trim()));
const now = await page.$eval('.strip__mv[aria-current]', (b) => b.dataset.ply);
ok(strip.length === 4 && now === '3', 'the strip lists the moves with the last one current', `${strip.join(' ')} | current ${now}`);
await page.click('.strip__mv[data-ply="0"]');
await sleep(500);
const opened = await page.evaluate(() => [document.documentElement.dataset.mode, document.querySelector('.strip__mv[aria-current]')?.dataset.ply]);
ok(opened[0] === 'study' && opened[1] === '0', 'a tap on the strip opens that move', opened.join(' '));

// the card on the puzzles page
await page.goto(base + '/ushtrime/?tema=gabimet', { waitUntil: 'networkidle0' });
await sleep(1500);
const head = await page.$eval('[data-glyph]', (e) => e.textContent);
ok(head.includes('Gjej më të mirën'), 'the puzzles page opens on the learner’s own mistake', head);
const good = card[0].good[0];
await page.evaluate((g) => window.__puzzle.move(g.slice(0, 2), g.slice(2, 4)), good);
await sleep(1200);
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('shah.progress.v1')).cards[0]);
ok(after.box === 1 && after.due > new Date().toISOString().slice(0, 10), 'solved first time: back in a day', `box ${after.box}, due ${after.due}`);
const title = await page.$eval('[data-title]', (e) => e.textContent);
ok(title.includes('Kthehet nesër'), 'the coach says when it comes back', title);

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nthe loop works');
process.exit(failed ? 1 : 0);
