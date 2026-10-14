// A game between two friends online, in two separate headless Chrome profiles (two phones): the room made from the
// play page's sheet, the link opened by the friend, moves arriving on the other board, mate, a rematch with the
// colours swapped, a draw offered and taken, a dropped connection healed, a reload that keeps the seat, a full room
// refused, and the finished game opened on the analysis board.
// Needs the dev server (3770) and the local server: npx wrangler dev -c server/wrangler.jsonc --port 8787 --test-scheduled
// node tools/test-online.mjs [base]
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
const errors = [];
async function phone(label) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  return page;
}
const st = (p) => p.evaluate(() => window.__online?.state());
const until = async (p, fn, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await st(p).catch(() => null);
    if (s && fn(s)) return s;
    await sleep(80);
  }
  return st(p).catch(() => null);
};
const click = (p, sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
const card = (p) => p.evaluate(() => ({ glyph: document.querySelector('[data-glyph]').textContent.trim(), title: document.querySelector('[data-title]').textContent.trim(), acts: [...document.querySelectorAll('[data-act]:not([hidden])')].map((b) => b.dataset.act) }));
const ready = (p) => p.waitForFunction(() => window.__online && document.querySelector('[data-board] canvas, [data-board] svg'), { timeout: 30000 });

const A = await phone('A');
const B = await phone('B');

// the play page's sheet: a friend online, White, no clock
await A.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await A.evaluate(() => document.querySelector('[data-new]').click());
await sleep(700);
await A.evaluate(() => document.querySelector('input[name="opponent"][value="online"]').click());
const hidden = await A.evaluate(() => getComputedStyle(document.querySelector('[data-not-online]')).display === 'none' && getComputedStyle(document.querySelector('[data-when-online]')).display !== 'none');
ok(hidden, 'choosing “Shok online” hides the levels and the button says it makes the game');
await A.evaluate(() => {
  document.querySelector('input[name="side"][value="w"]').click();
  document.querySelector('input[name="clock"][value="none"]').click();
  document.querySelector('[data-setup] button[type="submit"]').click();
});
await A.waitForFunction(() => location.pathname === '/online/' && window.__online, { timeout: 20000 });
await ready(A);
let a = await until(A, (s) => s.state?.status === 'waiting');
const code = a?.state?.code;
ok(a?.state?.status === 'waiting' && /^[A-Z2-9]{4}$/.test(code ?? '') && a.state.you === 'w', 'the room is made and waits for the friend', code);
let c = await card(A);
ok(c.glyph === code && c.acts.includes('share') && c.acts.includes('copy'), 'the card shows the code with “Dërgo lidhjen”', `${c.glyph} ${c.acts.join(',')}`);

// the friend opens the link
await B.goto(`${base}/online/?kod=${code.toLowerCase()}`, { waitUntil: 'networkidle0' });
await ready(B);
let b = await until(B, (s) => s.invite);
c = await card(B);
ok(b?.invite?.seat === 'b' && c.acts.includes('join') && c.title.includes('të zezat'), 'the link shows the invitation: Black, no clock', c.title);
await click(B, '[data-act="join"]');
b = await until(B, (s) => s.state?.status === 'playing');
a = await until(A, (s) => s.state?.status === 'playing');
ok(a?.state?.status === 'playing' && b?.state?.you === 'b', 'the friend joins and the game starts on both phones');
ok((await card(A)).glyph === 'Radha jote' && (await card(B)).glyph === 'Radha e shokut', 'each phone knows whose turn it is');

// moves cross over
await B.evaluate(() => window.__online.move('e7', 'e5'));
await sleep(300);
ok((await st(B)).shown.length === 0, 'Black cannot move before White');
const play = async (p, q, f, t) => {
  const n = (await st(p)).state.moves.length;
  await p.evaluate((f, t) => window.__online.move(f, t), f, t);
  await until(q, (s) => s.state?.moves.length === n + 1);
};
await play(A, B, 'e2', 'e4');
b = await st(B);
ok(b.state.sans[0] === 'e4' && b.shown[0] === 'e2e4', 'White’s move arrives on the friend’s board');
const strip = await B.$$eval('[data-strip] .strip__mv', (l) => l.map((e) => e.textContent));
ok(strip.join(' ') === 'e4', 'the move strip shows it', strip.join(' '));
await play(B, A, 'e7', 'e5');
await play(A, B, 'f1', 'c4');
await play(B, A, 'b8', 'c6');
await play(A, B, 'd1', 'h5');
await play(B, A, 'g8', 'f6');
await play(A, B, 'h5', 'f7');
a = await until(A, (s) => s.state?.status === 'over');
b = await until(B, (s) => s.state?.status === 'over');
ok(a.state.result.reason === 'mate' && (await card(A)).glyph === 'Fitove' && (await card(B)).glyph === 'Humbe', 'scholar’s mate: “Fitove” on one phone, “Humbe” on the other');

// rematch: colours change hands
await click(B, '[data-act="rematch"]');
await until(A, (s) => s.state?.rematch.b);
c = await card(A);
ok(c.title.includes('Shoku do revansh'), 'the other phone hears the friend wants a rematch', c.title);
await click(A, '[data-act="rematch"]');
a = await until(A, (s) => s.state?.round === 2);
b = await until(B, (s) => s.state?.round === 2);
ok(a?.state.you === 'b' && b?.state.you === 'w' && a.shown.length === 0, 'the rematch swaps the colours and clears the board');
const flipped = await A.evaluate(() => window.__online.state().seat.side);
ok(flipped === 'b', 'the seat remembers the new colour');

// a draw offered and taken
await click(B, '[data-act="draw"]');
await until(A, (s) => s.state?.drawOffer === 'w');
c = await card(A);
ok(c.acts.includes('accept') && c.title === 'Shoku ofron barazim.', 'the offer shows on the other phone with “Prano barazimin”', c.acts.join(','));
await click(A, '[data-act="accept"]');
b = await until(B, (s) => s.state?.status === 'over');
ok(b.state.result.reason === 'agreed' && (await card(B)).glyph === 'Barazim', 'taken: a draw for both');

// round 3: a dropped connection heals by itself; a reload keeps the seat
await click(A, '[data-act="rematch"]');
await click(B, '[data-act="rematch"]');
await until(A, (s) => s.state?.round === 3 && s.state.status === 'playing');
await A.evaluate(() => window.__online.drop());
b = await until(B, (s) => s.state && !s.state.here[s.state.you === 'w' ? 'b' : 'w'], 4000);
const awayName = await B.$eval('[data-them] [data-name]', (e) => e.textContent);
ok(awayName === 'Shoku · larg', 'while the friend’s phone is gone, their name says so', awayName);
b = await until(B, (s) => s.state?.here.w && s.state?.here.b, 8000);
ok(b?.state.here.w && b.state.here.b, 'the dropped phone reconnects by itself');
a = await st(A);
const youBefore = a.state.you;
const mover = a.state.you === 'w' ? A : B;
const other = mover === A ? B : A;
await play(mover, other, 'd2', 'd4');
await A.reload({ waitUntil: 'networkidle0' });
await ready(A);
a = await until(A, (s) => s.state?.round === 3 && s.state.moves.length === 1);
ok(a?.state?.moves[0] === 'd2d4' && a.state.you === youBefore, 'after a reload the phone is back in its seat with the moves', JSON.stringify(a?.state?.moves));

// a third phone with the code finds the room full
const C = await phone('C');
await C.goto(base + '/online/', { waitUntil: 'networkidle0' });
await ready(C);
await click(C, '[data-act="code"]');
await C.type('[data-code-form] input', code.toLowerCase());
await click(C, '[data-code-form] button[type="submit"]');
await sleep(800);
const full = await C.$eval('[data-code-note]', (e) => e.textContent);
ok(full.includes('Nuk ka lojë të lirë'), 'a third phone with the code is told the game is full', full);

// resigning, then the finished game on the analysis board
await B.evaluate(() => document.querySelector('[data-act="resign"]').click());
await B.evaluate(() => document.querySelector('[data-act="resign"]').click());
a = await until(A, (s) => s.state?.status === 'over');
ok(a.state.result.reason === 'resign' && (await card(A)).glyph === 'Fitove', 'resigning takes two presses and ends the game');
await click(A, '[data-act="analyse"]');
await A.waitForFunction(() => location.pathname === '/analizo/' && window.__analyse && window.__analyse.state().line.length === 1, { timeout: 30000 }).catch(() => {});
const line = await A.evaluate(() => window.__analyse?.state().line ?? []);
ok(line.join(' ') === 'd4', 'the game opens on the analysis board', line.join(' '));

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nonline play works');
process.exit(failed ? 1 : 0);
