// A challenge between friends ("Sfida") end to end: one player makes it and solves all ten, a friend opens the link,
// solves three and misses the rest, and both see the same board in the right order. Dev server and server running.
//   node tools/test-contest.mjs [base]
import puppeteer from 'puppeteer-core';
import { Chess } from 'chess.js';

const base = process.argv[2] ?? 'http://127.0.0.1:3770';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
let failed = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
const errors = [];

async function player() {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.goto(base + '/404.html');
  await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('shah.unboxed', t); localStorage.setItem('shah.welcome', 'done'); }, today);
  return page;
}

/** Play the challenge: solve the first `solve` puzzles, miss the rest with a legal wrong move. */
async function play(page, solve) {
  for (let k = 0; k < 40; k++) {
    const s = await page.evaluate(() => window.__puzzle.state());
    if (s.mode !== 'contest') return;
    if (s.done || !s.next) {
      await sleep(300);
      continue;
    }
    const n = await page.evaluate(() => Number(document.querySelector('[data-puzzle-rating]').textContent.split('/')[0]));
    let uci = s.next;
    if (n > solve) {
      const c = new Chess(s.fen);
      const wrong = c.moves({ verbose: true }).find((m) => m.from + m.to !== s.next.slice(0, 4) && !m.promotion);
      uci = wrong.from + wrong.to;
    }
    // a promotion waits for the picker
    page.evaluate((f, t) => window.__puzzle.move(f, t), uci.slice(0, 2), uci.slice(2, 4));
    if (uci[4]) {
      await sleep(200);
      await page.evaluate((p) => document.querySelector(`[data-promo] [data-piece="${p}"]`)?.click(), uci[4]);
    }
    await sleep(1500);
  }
}

// one player makes the challenge and solves it all
const a = await player();
await a.goto(base + '/ushtrime/', { waitUntil: 'networkidle0' });
await a.waitForFunction(() => window.__puzzle, { timeout: 30000 });
await sleep(1000);
ok(await a.evaluate(() => !document.querySelector('[data-contest-new]').hidden), 'with a server, the puzzle page offers a challenge with friends');
await a.evaluate(() => document.querySelector('[data-contest-new]').click());
await sleep(500);
await a.evaluate(() => document.querySelector('[data-contest-go]').click());
await sleep(300);
ok(await a.evaluate(() => !document.querySelector('[data-contest-err]').hidden), 'a challenge needs a name');
await a.type('[data-contest-name]', 'Ana');
await a.evaluate(() => document.querySelector('[data-contest-go]').click());
await a.waitForFunction(() => /sfida=/.test(location.search), { timeout: 15000 }).catch(() => {});
const code = await a.evaluate(() => new URLSearchParams(location.search).get('sfida'));
ok(/^[A-Z2-9]{4}$/.test(code ?? ''), 'it is made, with a code in the address', code);
ok(await a.evaluate(() => !document.querySelector('[data-contest-invite]').hidden && document.querySelector('[data-contest-go]').textContent === 'Fillo'), 'then it offers to invite friends and to start');
await a.evaluate(() => document.querySelector('[data-contest-go]').click());
await sleep(1500);
ok(await a.evaluate(() => window.__puzzle.state().mode === 'contest' && document.querySelector('[data-hint]').hidden), 'the challenge plays without help');
await play(a, 10);
await a.waitForFunction(() => document.querySelector('dialog[data-panel="contest"]').open, { timeout: 20000 }).catch(() => {});
const aLede = await a.evaluate(() => document.querySelector('[data-contest-lede]').textContent);
ok(/^Zgjidhe 10 nga 10/.test(aLede) && /Vendi yt: 1 nga 1/.test(aLede), 'all ten solved: first of one', aLede);

// a friend opens the link, solves three, misses the rest
const b = await player();
await b.goto(`${base}/ushtrime/?sfida=${code}`, { waitUntil: 'networkidle0' });
await b.waitForFunction(() => document.querySelector('dialog[data-panel="contest"]').open, { timeout: 20000 }).catch(() => {});
const bLede = await b.evaluate(() => document.querySelector('[data-contest-lede]').textContent);
ok(/^Sfida nga Ana: 10 ushtrime/.test(bLede), 'the link opens the challenge, named after who made it', bLede);
ok((await b.evaluate(() => document.querySelectorAll('[data-contest-board] li').length)) === 1, 'and shows the board so far');
await b.type('[data-contest-name]', 'Ben');
await b.evaluate(() => document.querySelector('[data-contest-go]').click());
await sleep(1500);
await play(b, 3);
await b.waitForFunction(() => document.querySelector('dialog[data-panel="contest"]').open, { timeout: 20000 }).catch(() => {});
const rows = await b.evaluate(() => [...document.querySelectorAll('[data-contest-board] li')].map((l) => l.textContent.replace(/\s+/g, ' ').trim()));
ok(rows.length === 2 && rows[0].includes('Ana') && rows[0].includes('10/10') && rows[1].includes('Ben') && rows[1].includes('3/10'), 'both on the board, the better first', rows.join(' | '));
ok(await b.evaluate(() => document.querySelector('[data-contest-board] li:nth-child(2)').hasAttribute('data-me')), "the friend's own row is marked");
ok(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nthe challenge works');
process.exit(failed ? 1 : 0);
