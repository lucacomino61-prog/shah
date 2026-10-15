// A stronger bot resigns a lost game after three moves of it, as people do (dev server running).
//   node tools/test-resign.mjs
import puppeteer from 'puppeteer-core';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 1280, height: 800 });
await page.goto('http://127.0.0.1:3770/404.html');
// a game saved with Besniku (id 3) a queen and a rook down, the learner to move
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem(
    'shah.game.v1',
    JSON.stringify({ fens: ['6k1/5ppp/8/8/8/8/5PPP/3QR1K1 b - - 0 1', '6k1/5pp1/7p/8/8/8/5PPP/3QR1K1 w - - 0 2'], sans: ['h6'], ucis: ['h7h6'], side: 'w', level: 3, verdicts: [null], evals: [null], clock: null, friend: false }),
  );
});
await page.goto('http://127.0.0.1:3770/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready' && window.__play.state().phase === 'user', { timeout: 60000 });
for (const [f, t] of [['d1', 'd2'], ['d2', 'd3'], ['d3', 'd4'], ['d4', 'd5']]) {
  if ((await page.evaluate(() => window.__play.state().phase)) === 'over') break;
  await page.evaluate((f, t) => window.__play.move(f, t), f, t).catch(() => {});
  await page.waitForFunction(() => ['user', 'over'].includes(window.__play.state().phase), { timeout: 40000 }).catch(() => {});
  await sleep(300);
}
const st = await page.evaluate(() => window.__play.state());
const words = await page.evaluate(() => document.body.innerText.match(/[^\n]*u dorëzua[^\n]*/)?.[0] ?? null);
let failed = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
ok(st.phase === 'over' && !!words, 'Besniku resigns after three moves in a lost position', `${words} (${st.sans.join(' ')})`);
ok(st.sans.length === 6, 'and not before the third', String(st.sans.length));
ok(!errors.length, 'no page errors', errors.join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nthe bots resign as people do');
process.exit(failed ? 1 : 0);
