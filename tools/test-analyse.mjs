// The analysis board in headless Chrome (phone profile): the engine's lines, free moves, setting up a position,
// a pasted game reviewed move by move with the learner's mistake kept as a puzzle, and the chess.com and Lichess
// game lists. chess.com and Lichess do not resolve on this network, so their answers are stand-ins in the shape
// of their public APIs (served by request interception). node tools/test-analyse.mjs [base]
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://127.0.0.1:3770';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, label, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
const MATE = '[White "Ana"]\n[Black "Luca"]\n\n1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0';

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
await page.goto(base + '/analizo/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__analyse && window.__analyse.state().lines > 0, { timeout: 40000 });
ok(true, 'the engine shows its best lines for the start');
// the stand-ins go in only once the engine is loaded: intercepting a page holds up its worker's own requests
await page.setRequestInterception(true);
page.on('request', (req) => {
  const u = req.url();
  const cors = { 'Access-Control-Allow-Origin': '*' };
  if (u.startsWith('https://api.chess.com/pub/player/luca/games/archives')) return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ archives: ['https://api.chess.com/pub/player/luca/games/2026/10'] }) });
  if (u.startsWith('https://api.chess.com/pub/player/luca/games/2026/10'))
    return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ games: [{ pgn: MATE, rules: 'chess', time_class: 'blitz', end_time: 1760400000, white: { username: 'Ana', result: 'win' }, black: { username: 'Luca', result: 'checkmated' } }] }) });
  if (u.startsWith('https://api.chess.com/pub/player/nobody')) return req.respond({ status: 404, headers: cors, body: '{}' });
  if (u.startsWith('https://lichess.org/api/games/user/luca'))
    return req.respond({ status: 200, headers: cors, contentType: 'application/x-ndjson', body: JSON.stringify({ pgn: MATE, variant: 'standard', speed: 'rapid', createdAt: 1760400000000, winner: 'white', players: { white: { user: { name: 'Ana' } }, black: { user: { name: 'Luca' } } } }) + '\n' });
  req.continue();
});

await page.evaluate(() => window.__analyse.move('e2', 'e4'));
await sleep(600);
let st = await page.evaluate(() => window.__analyse.state());
ok(st.line.join(' ') === 'e4' && st.at === 0, 'a move on the board starts a line', st.line.join(' '));

// set up: a position without a black king is refused, with one it opens
await page.evaluate(() => document.querySelector('[data-edit]').click());
await sleep(300);
await page.evaluate(() => {
  window.__analyse.pen('x');
  window.__analyse.place('e8');
});
await page.evaluate(() => document.querySelector('[data-done]').click());
await sleep(300);
st = await page.evaluate(() => window.__analyse.state());
const told = await page.$eval('[data-title]', (e) => e.textContent);
ok(st.editing && told.includes('mbret'), 'a position without both kings is refused, and says why', told);
await page.evaluate(() => {
  window.__analyse.pen('bk');
  window.__analyse.place('h8');
});
await page.evaluate(() => document.querySelector('[data-done]').click());
await sleep(500);
st = await page.evaluate(() => window.__analyse.state());
ok(!st.editing && st.fen.startsWith('rnbqkbn') === false && st.fen.includes('k'), 'with both kings the set-up position opens for analysis', st.fen);

// a pasted game: reviewed move by move; the learner's side chosen afterwards, its blunder kept as a puzzle
await page.$eval('[data-paste] textarea', (t, v) => (t.value = v), MATE);
await page.evaluate(() => document.querySelector('[data-paste] button[type="submit"]').click());
await page.waitForFunction(() => window.__analyse.state().review?.done, { timeout: 90000 });
st = await page.evaluate(() => window.__analyse.state());
ok(st.review.verdicts[5] === 'blunder', 'the review finds 3…Nf6?? a blunder', st.review.verdicts.join(' '));
await page.evaluate(() => document.querySelector('input[name="me"][value="b"]').click());
await sleep(300);
const cards = await page.evaluate(() => JSON.parse(localStorage.getItem('shah.progress.v1') || '{}').cards ?? []);
ok(cards.some((c) => c.played === 'Nf6'), 'choosing black keeps the blunder as one of the learner’s puzzles', cards.map((c) => c.played).join(' '));
const rows = await page.$$eval('[data-review-rows] dt', (l) => l.map((e) => e.textContent));
ok(rows.includes('Të zezat (ti)'), 'the summary marks the learner’s side', rows.join(' / '));

// chess.com and Lichess: the recent games list, a game opened and reviewed, an unknown player named
await page.evaluate(() => {
  document.querySelector('[data-fetch] input[name="user"]').value = 'luca';
  document.querySelector('[data-fetch] button[type="submit"]').click();
});
await page.waitForFunction(() => document.querySelectorAll('[data-games] [data-game]').length > 0, { timeout: 15000 }).catch(() => {});
const list = await page.$$eval('[data-games] [data-game]', (l) => l.map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
ok(list.length === 1 && list[0].includes('Me të zezat kundër Ana') && list[0].includes('Humbje'), 'chess.com: the recent games are listed from the learner’s side', list[0] ?? 'none');
await page.evaluate(() => document.querySelector('[data-games] [data-game]').click());
await page.waitForFunction(() => window.__analyse.state().review?.done, { timeout: 90000 });
st = await page.evaluate(() => window.__analyse.state());
ok(st.review.me === 'b', 'the fetched game is reviewed for the learner’s colour', st.review.me);
await page.evaluate(() => {
  document.querySelector('input[name="site"][value="lichess"]').click();
  document.querySelector('[data-fetch] button[type="submit"]').click();
});
await sleep(1500);
const li = await page.$$eval('[data-games] [data-game]', (l) => l.map((b) => b.textContent.replace(/\s+/g, ' ').trim()));
ok(li.length === 1 && li[0].includes('rapid'), 'Lichess: the recent games are listed too', li[0] ?? 'none');
await page.evaluate(() => {
  document.querySelector('input[name="site"][value="chesscom"]').click();
  document.querySelector('[data-fetch] input[name="user"]').value = 'nobody';
  document.querySelector('[data-fetch] button[type="submit"]').click();
});
await sleep(1200);
const note = await page.$eval('[data-fetch-note]', (e) => e.textContent);
ok(note.includes('nobody'), 'an unknown player is named in the answer', note);

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nthe analysis board works');
process.exit(failed ? 1 : 0);
