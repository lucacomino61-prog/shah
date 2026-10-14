// The extras in headless Chrome (phone profile): threats on the board, today's puzzle and the streak, the
// three-minute race, the settings switches and the backup. node tools/test-extras.mjs [base]
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Chess } from 'chess.js';
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
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('dialog', (d) => void d.accept());
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('shah.progress.v1') || '{}'));

// threats: a bishop left where a pawn takes it is ringed in red, and the switch turns the rings off
await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready' && window.__board, { timeout: 30000 });
await page.evaluate(() => window.__play.setLevel(1));
await page.evaluate(() => window.__play.move('e2', 'e4'));
await page.waitForFunction(() => window.__play.state().sans.length === 2 && window.__play.state().phase === 'user', { timeout: 30000 });
await page.evaluate(() => window.__play.move('f1', 'a6'));
await page.waitForFunction(() => window.__play.state().sans.length === 4 && window.__play.state().phase === 'user', { timeout: 30000 });
await sleep(400);
const st = await page.evaluate(() => window.__play.state());
const bishopStands = new Chess(st.fen).get('a6')?.type === 'b';
const danger = await page.evaluate(() => window.__board.danger());
ok(!bishopStands || danger.includes('a6'), 'a piece the opponent can take is ringed in red', bishopStands ? danger.join(' ') : 'the bishop was taken already');
await page.evaluate(() => document.querySelector('[data-threats]').click());
await sleep(200);
ok((await page.evaluate(() => window.__board.danger())).length === 0 && (await store()).threats === false, 'the switch turns the rings off and remembers it');
await page.evaluate(() => document.querySelector('[data-threats]').click());

// today's puzzle: solved, it starts the streak and stays solved for the day; home shows the flame
await page.goto(base + '/ushtrime/?tema=dita', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__puzzle && window.__puzzle.state().next && window.__puzzle.state().mode === 'daily' && !document.querySelector('[data-status]').textContent.includes('lëviz…'), { timeout: 30000 });
let s = await store();
ok(s.daily && s.daily.solved === false, "today's puzzle is chosen and kept for the day", JSON.stringify(s.daily));
for (let i = 0; i < 8; i++) {
  const ps = await page.evaluate(() => window.__puzzle.state());
  if (ps.done || !ps.next) break;
  await page.evaluate((u) => window.__puzzle.move(u.slice(0, 2), u.slice(2, 4)), ps.next);
  await sleep(1400);
}
s = await store();
ok(s.daily?.solved === true && s.streak?.count === 1, 'solving it starts a one-day streak', JSON.stringify(s.streak));
await page.goto(base + '/ushtrime/?tema=dita', { waitUntil: 'networkidle0' });
await sleep(1500);
ok((await page.$eval('[data-glyph]', (e) => e.textContent)).includes('U zgjidh sot'), 'today it says it is done and comes back tomorrow');
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await sleep(800);
const flame = await page.$eval('[data-streak]', (e) => ({ hidden: e.hidden, n: e.querySelector('[data-streak-n]').textContent }));
ok(!flame.hidden && flame.n === '1', 'the home screen shows the streak beside Luaj', JSON.stringify(flame));

// the race: a solved puzzle scores, three wrong moves end it, the record is kept
await page.goto(base + '/ushtrime/?tema=gara', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__puzzle && window.__puzzle.state().mode === 'rush' && window.__puzzle.state().next && !document.querySelector('[data-status]').textContent.includes('lëviz…'), { timeout: 30000 });
for (let i = 0; i < 8; i++) {
  const ps = await page.evaluate(() => window.__puzzle.state());
  if (ps.rush.score >= 1) break;
  if (!ps.next) break;
  await page.evaluate((u) => window.__puzzle.move(u.slice(0, 2), u.slice(2, 4)), ps.next);
  await sleep(1300);
}
ok((await page.evaluate(() => window.__puzzle.state().rush.score)) >= 1, 'a solved race puzzle scores a point');
for (let strike = 0; strike < 3; strike++) {
  await page.waitForFunction(() => window.__puzzle.state().next && !document.querySelector('[data-status]').textContent.includes('lëviz…'), { timeout: 20000 });
  const ps = await page.evaluate(() => window.__puzzle.state());
  const wrong = new Chess(ps.fen).moves({ verbose: true }).find((m) => m.from + m.to !== ps.next.slice(0, 4) && !m.promotion);
  await page.evaluate((m) => window.__puzzle.move(m.from, m.to), { from: wrong.from, to: wrong.to });
  await sleep(1300);
}
const after = await page.evaluate(() => window.__puzzle.state());
s = await store();
ok(!after.rush.active && after.rush.strikes === 3, 'three wrong moves end the race', `strikes ${after.rush.strikes}`);
ok(s.rushBest >= 1, 'the best race score is kept', `best ${s.rushBest}`);

// a friend on the same phone: no engine move, the turn passes, the rows name the colours, take-back is one move
await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready', { timeout: 30000 });
await page.evaluate(() => document.querySelector('[data-new]').click());
await sleep(700);
await page.click('input[name="opponent"][value="friend"]');
const hidden = await page.$eval('[data-engine-only]', (e) => getComputedStyle(e).display === 'none');
await page.click('.setup button[type="submit"]');
await sleep(600);
await page.evaluate(() => window.__play.move('e2', 'e4'));
await sleep(2500);
let fs1 = await page.evaluate(() => window.__play.state());
ok(hidden && fs1.friend && fs1.side === 'b' && fs1.phase === 'user' && fs1.sans.length === 1, 'with a friend the engine stays out and black moves next', `${fs1.sans.join(' ')} side ${fs1.side}`);
await page.evaluate(() => window.__play.move('e7', 'e5'));
await sleep(2500);
const names = await page.evaluate(() => [...document.querySelectorAll('.score__name')].map((e) => e.textContent));
fs1 = await page.evaluate(() => window.__play.state());
ok(fs1.sans.length === 2 && names.includes('Të bardhat') && names.includes('Të zezat'), 'the rows name the colours and the turn comes back to white', names.join(' / '));
await page.evaluate(() => document.querySelector('[data-undo]').click());
await sleep(800);
fs1 = await page.evaluate(() => window.__play.state());
ok(fs1.sans.length === 1 && fs1.side === 'b', 'a take-back with a friend undoes one move', fs1.sans.join(' '));

// settings: the switches write the store; the backup loads back what it holds
await page.goto(base + '/progresi/', { waitUntil: 'networkidle0' });
await page.click('[data-sound]');
await sleep(200);
ok((await store()).sound === false, 'the sound switch turns sound off');
const backup = { app: 'shah', version: 1, saved: new Date().toISOString(), progress: { ...(await store()), puzzleRating: 1234 }, game: null };
const file = join(tmpdir(), 'shah-backup-test.json');
writeFileSync(file, JSON.stringify(backup));
const input = await page.$('[data-import-file]');
await input.uploadFile(file);
await page.evaluate(() => document.querySelector('[data-import-file]').dispatchEvent(new Event('change', { bubbles: true })));
await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
ok((await store()).puzzleRating === 1234, 'a backup file loads back into the app', `rating ${(await store()).puzzleRating}`);

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nthe extras work');
process.exit(failed ? 1 : 0);
