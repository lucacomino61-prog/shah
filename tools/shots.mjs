// Screenshots of every page in headless Chrome on the real GPU (the app's browser pane pauses WebGL frames when
// hidden). Also plays a blunder on /luaj/ and opens "Shiko pse". Output: .impeccable/review/*.png
// node tools/shots.mjs [base] [--views=mobile,desktop]
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const base = args.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:3770';
const out = join(process.cwd(), '.impeccable', 'review');
mkdirSync(out, { recursive: true });
const VIEWS = {
  mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1 },
};
const views = (flags.views ?? 'mobile,desktop').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  userDataDir: join(process.env.TEMP || '.', 'shah-chrome-shots'),
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11', '--hide-scrollbars'],
});

const errors = [];
for (const v of views) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport(VIEWS[v]);
  page.on('pageerror', (e) => errors.push(`${v} ${page.url()}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${v} ${page.url()}: ${m.text()}`));
  const shot = async (name) => {
    await page.screenshot({ path: join(out, `${name}-${v}.png`) });
    console.log(`${name}-${v}.png`);
  };
  for (const [path, name, wait] of [
    ['/', 'home', 4500],
    ['/ushtrime/', 'ushtrime', 3000],
    ['/mesime/', 'mesime', 1200],
    ['/mesime/piruni/', 'mesim', 2500],
    ['/progresi/', 'progresi', 1000],
  ]) {
    await page.goto(base + path, { waitUntil: 'networkidle0' });
    await sleep(wait);
    await shot(name);
  }
  // the game: a blunder, the coach's verdict, then the line on the board
  await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready', { timeout: 30000 });
  await sleep(1500);
  await shot('luaj');
  await page.evaluate(() => window.__play.move('e2', 'e4'));
  await page.waitForFunction(() => window.__play.state().phase === 'user' && window.__play.state().sans.length === 2, { timeout: 30000 });
  await page.evaluate(() => window.__play.move('f1', 'a6'));
  await page.waitForFunction(() => window.__play.state().verdicts[2], { timeout: 30000 });
  await sleep(900);
  await shot('luaj-verdict');
  await page.click('[data-why]');
  await sleep(2600);
  await shot('luaj-analysis');
  await ctx.close();
}
await browser.close();
console.log(errors.length ? `\nerrors:\n${errors.join('\n')}` : '\nno page errors');
