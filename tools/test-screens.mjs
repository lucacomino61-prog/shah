// Every page is one screen (Luca, 2026-10-16: "everything inside a page not to scroll on menus except the settings"):
// at a small phone, a large one and a desktop, no page scrolls but the settings, nothing runs off the side, and each
// table's sheet opens over it and closes again. Dev server running.
//   node tools/test-screens.mjs [base]
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://127.0.0.1:3770';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const pages = ['/', '/luaj/', '/ushtrime/', '/mesime/', '/mesime/piruni/', '/mesime/rokada/', '/mesime/hapje/italiania/', '/analizo/', '/online/', '/progresi/', '/rregullat-e-shahut/', '/si-luhet-shahu/', '/privatesia/', '/404.html'];
const sheets = [['/luaj/', 'record'], ['/ushtrime/', 'themes'], ['/analizo/', 'games'], ['/online/', 'record'], ['/mesime/hapje/italiania/', 'lines']];
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
let failed = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
const errors = [];
for (const [w, h] of [[320, 568], [390, 844], [1440, 900]]) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${w}x${h} ${page.url()}: ${e.message}`));
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 800, hasTouch: w < 800 });
  await page.goto(base + '/404.html');
  await page.evaluate((t) => {
    localStorage.clear();
    localStorage.setItem('shah.unboxed', t);
    localStorage.setItem('shah.welcome', 'done');
    const games = [7, 8, 9, 1, 2, 8, 9].map((l, i) => ({ date: `2026-10-0${i + 1}T18:00:00Z`, side: 'w', level: l, result: i % 2 ? 'win' : 'loss', moves: 30, accuracy: 60 + i * 3, blunders: 1, mistakes: 1, opening: null }));
    localStorage.setItem('shah.progress.v1', JSON.stringify({ games, lessons: ['vlera-e-figurave'], tags: { hanging: 3, 'allowed-fork': 1 } }));
  }, today);
  const tall = [];
  const wide = [];
  for (const p of pages) {
    await page.goto(base + p, { waitUntil: 'networkidle0' }).catch(() => {});
    await sleep(1200);
    const m = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollHeight - innerHeight, wide: document.scrollingElement.scrollWidth - innerWidth }));
    if (m.scroll > 1) tall.push(`${p} ${m.scroll}px`);
    if (m.wide > 1) wide.push(`${p} ${m.wide}px`);
  }
  ok(!tall.length, `${w}x${h}: no page scrolls`, tall.join(', '));
  ok(!wide.length, `${w}x${h}: nothing runs off the side`, wide.join(', '));
  await page.goto(base + '/progresi/cilesimet/', { waitUntil: 'networkidle0' });
  ok((await page.evaluate(() => document.scrollingElement.scrollHeight - innerHeight)) > 0, `${w}x${h}: the settings scroll`);
  if (w < 800) {
    for (const [p, name] of sheets) {
      await page.goto(base + p, { waitUntil: 'networkidle0' }).catch(() => {});
      await sleep(1500);
      await page.evaluate(() => document.querySelector('[data-intro-skip]')?.click());
      await page.evaluate((n) => document.querySelector(`[data-panel-open="${n}"]`).click(), name);
      await sleep(600);
      const open = await page.evaluate((n) => document.querySelector(`dialog[data-panel="${n}"]`).open, name);
      await page.evaluate((n) => document.querySelector(`dialog[data-panel="${n}"] [data-panel-close]`).click(), name);
      await sleep(500);
      const closed = await page.evaluate((n) => !document.querySelector(`dialog[data-panel="${n}"]`).open, name);
      ok(open && closed, `${w}x${h}: ${p} opens its sheet (${name}) and closes it`);
    }
  }
  await ctx.close();
}
ok(!errors.length, 'no page errors', errors.slice(0, 3).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nevery page is one screen');
process.exit(failed ? 1 : 0);
