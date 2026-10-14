// The opening and the four small moments, in headless Chrome on a phone (dev server, 3770): the board shut in its
// case on the first visit of the day, a tap opening it and the 32 pieces landing one by one, the page rising in after,
// no case on the second visit, Skip; the mated king going over and standing up for the next game; a captured piece
// popping in; a promotion sinking and rising; the streak rolling up when today's puzzle is solved; and none of it
// with the Stop-animations switch.
// node tools/test-animations.mjs [base]
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://127.0.0.1:3770';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, label, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const errors = [];
async function phone() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(e.message));
  return page;
}
const fx = (p) => p.evaluate(() => window.__board.fx());
const gate = (p) => p.evaluate(() => 'hasUnbox' in document.documentElement.dataset);

// ------------------------------------------------------------------ the opening
let page = await phone();
await page.goto(base + '/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__board, { timeout: 30000 });
await sleep(600);
let f = await fx(page);
const risen = () => page.evaluate(() => [...document.querySelectorAll('[data-rise]')].map((e) => getComputedStyle(e).opacity));
ok((await gate(page)) && f.box === 'shut' && f.visible === 0, 'first visit of the day: the box lies shut, no pieces out', JSON.stringify(f));
ok((await risen()).every((o) => o === '0'), 'the rest of the page waits');
const cue = await page.$eval('[data-unbox-open]', (b) => b.textContent.trim());
ok(cue === 'Prek për ta hapur', 'a tap opens it', cue);
await page.evaluate(() => document.querySelector('[data-unbox-open]').click());
await sleep(500);
f = await fx(page);
ok(f.unboxing && f.box === 'moving' && f.phase === 'open', 'the lid swings open on its hinge', JSON.stringify(f));
const seen = new Set();
for (let i = 0; i < 60 && (await fx(page)).unboxing; i++) {
  seen.add((await fx(page)).phase);
  await sleep(150);
}
ok(
  ['unpack', 'turn', 'place'].every((p) => seen.has(p)),
  'the pieces come out, the box is turned over, the pieces are set',
  [...seen].join(' > '),
);
const t0 = Date.now();
await page.waitForFunction(() => !('hasUnbox' in document.documentElement.dataset), { timeout: 20000 }).catch(() => {});
const took = Date.now() - t0 + 500;
f = await fx(page);
const pieces = await page.evaluate(() => window.__board.state().pieces.length);
ok(!f.unboxing && f.box === 'play' && pieces === 32, 'it lies open with all 32 pieces on their squares', `${pieces} pieces, ${took} ms`);
await sleep(900);
ok((await risen()).every((o) => o === '1'), 'and the page has risen in');
ok((await page.evaluate(() => localStorage.getItem('shah.unboxed'))) === (await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })), 'today is remembered');
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__board, { timeout: 30000 });
await sleep(400);
f = await fx(page);
ok(!(await gate(page)) && f.box === 'play' && (await page.evaluate(() => window.__board.state().pieces.length)) === 32, 'a second visit the same day: the board is set at once');

// Skip, before and during the opening
await page.evaluate(() => localStorage.removeItem('shah.unboxed'));
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__board, { timeout: 30000 });
await page.evaluate(() => document.querySelector('[data-unbox-skip]').click());
await sleep(300);
ok(!(await gate(page)) && (await page.evaluate(() => window.__board.state().pieces.length)) === 32 && (await fx(page)).box === 'play', 'Kalo before the tap: open and set at once');
await page.evaluate(() => localStorage.removeItem('shah.unboxed'));
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__board, { timeout: 30000 });
await page.evaluate(() => document.querySelector('[data-unbox-open]').click());
await sleep(1700);
await page.evaluate(() => document.querySelector('[data-unbox-skip]').click());
await sleep(300);
ok(!(await gate(page)) && (await page.evaluate(() => window.__board.state().pieces.length)) === 32 && !(await fx(page)).unboxing, 'Kalo half-way: every piece lands at once');

// the Stop-animations switch: no case at all
await page.evaluate(() => {
  localStorage.removeItem('shah.unboxed');
  localStorage.setItem('shah.motion', 'off');
});
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__board, { timeout: 30000 });
await sleep(300);
ok(!(await gate(page)) && (await fx(page)).box === 'play', 'with animations stopped the board is simply open');
await page.evaluate(() => localStorage.removeItem('shah.motion'));

// ------------------------------------------------------------------ mate, capture, promotion (two players on one phone)
page = await phone();
await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__board, { timeout: 30000 });
await page.evaluate(() => document.querySelector('[data-new]').click());
await sleep(700);
await page.evaluate(() => {
  document.querySelector('input[name="opponent"][value="friend"]').click();
  document.querySelector('input[name="clock"][value="none"]').click();
  document.querySelector('[data-setup] button[type="submit"]').click();
});
await sleep(1200);
const mv = async (a, b, wait = 900) => {
  await page.evaluate((a, b) => window.__play.move(a, b), a, b);
  await sleep(wait);
};
await mv('e2', 'e4');
await mv('d7', 'd5');
await mv('e4', 'd5', 100);
const pop = await page.evaluate(() => [...document.querySelectorAll('[data-taken] .cap--in')].map((e) => getComputedStyle(e).animationName));
ok(pop.length === 1 && pop[0] === 'cap-in', 'a taken piece pops into the score capsule', JSON.stringify(pop));
await sleep(900);
ok((await page.evaluate(() => document.querySelectorAll('[data-taken] .cap').length)) === 1, 'the next drawing does not pop it again');
await page.evaluate(() => document.querySelector('[data-new]').click());
await sleep(700);
await page.evaluate(() => document.querySelector('[data-setup] button[type="submit"]').click());
await sleep(1500);
for (const [a, b] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4']]) await mv(a, b);
await mv('d8', 'h4', 2600);
f = await fx(page);
const king = f.fallen.find((x) => x.sq === 'e1');
ok(king && king.tilt > 1.4 && king.tilt < 1.8, 'mate: the white king lies over', JSON.stringify(f.fallen));
const lying = await page.evaluate(() => window.__board.square('e1'));
ok(lying.y > 0, 'and stays on the board');
await page.evaluate(() => document.querySelector('[data-again]').click());
await sleep(1600);
f = await fx(page);
ok(f.fallen.length === 0 && (await page.evaluate(() => window.__board.state().pieces.includes('wke1'))), 'a new game: the king stands up on e1');

await page.goto(base + '/analizo/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__analyse && window.__board, { timeout: 30000 });
await page.$eval('[data-paste] textarea', (t) => (t.value = '8/P6k/8/8/8/8/8/K7 w - - 0 1'));
await page.evaluate(() => document.querySelector('[data-paste] button[type="submit"]').click());
await sleep(1500);
await page.evaluate(() => {
  window.__analyse.move('a7', 'a8');
});
await sleep(250);
await page.evaluate(() => document.querySelector('[data-promo] [data-piece="q"]').click());
await sleep(500);
const during = (await fx(page)).morphing;
await sleep(1200);
const after = await page.evaluate(() => window.__board.state().pieces);
ok(during === 1 && after.includes('wqa8') && (await fx(page)).morphing === 0, 'a promotion sinks the pawn and raises the queen', `during ${during}, then ${after.join(' ')}`);

// ------------------------------------------------------------------ the streak
const yesterday = (() => {
  const d = new Date(Date.now() - 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();
await page.goto(base + '/ushtrime/?tema=dita', { waitUntil: 'networkidle0' });
await page.evaluate((y) => localStorage.setItem('shah.progress.v1', JSON.stringify({ ...JSON.parse(localStorage.getItem('shah.progress.v1') || '{}'), daily: null, streak: { count: 4, last: y } })), yesterday);
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__puzzle && window.__puzzle.state().next && window.__puzzle.state().mode === 'daily' && !document.querySelector('[data-status]').textContent.includes('lëviz…'), { timeout: 30000 });
ok((await page.$eval('[data-flame]', (e) => !e.hidden)) && (await page.$eval('[data-my-rating]', (e) => e.textContent)) === '4', 'today’s puzzle shows the flame and 4 days');
let rolled = false;
for (let i = 0; i < 6 && !rolled; i++) {
  const ps = await page.evaluate(() => window.__puzzle.state());
  if (ps.done || !ps.next) break;
  await page.evaluate((u) => window.__puzzle.move(u.slice(0, 2), u.slice(2, 4)), ps.next);
  for (let k = 0; k < 30 && !rolled; k++) {
    rolled = await page.evaluate(() => !!document.querySelector('[data-my-rating] .roll'));
    if (!rolled) await sleep(40);
  }
  if (!rolled) await sleep(1000);
}
ok(rolled, 'solving it rolls the count up');
await sleep(700);
ok((await page.$eval('[data-my-rating]', (e) => e.textContent)) === '5', 'to 5 days', await page.$eval('[data-my-rating]', (e) => e.textContent));

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nthe animations work');
process.exit(failed ? 1 : 0);
