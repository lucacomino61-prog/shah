// The installed app offline: visit once online, cut the network (page and service worker), then the play page
// must load from the cache and the engine must answer. Needs the production preview: npm run preview:lan
// node tools/test-offline.mjs [base]
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://localhost:3772';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, label, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  userDataDir: join(process.env.TEMP || '.', 'shah-chrome-offline'),
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(base + '/', { waitUntil: 'networkidle0' });
const manifest = await page.$eval('link[rel="manifest"]', (l) => l.href);
ok(manifest.endsWith('/manifest.webmanifest'), 'the manifest is linked');
await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), { timeout: 20000 });
await page.evaluate(() => navigator.serviceWorker.ready);
await sleep(3000);
const cached = await page.evaluate(async () => {
  const keys = await caches.keys();
  const c = await caches.open(keys[0]);
  return (await c.keys()).length;
});
ok(cached > 40, 'every file of the build is cached', `${cached} entries`);
// offline: the page and its service worker
await page.setOfflineMode(true);
const sw = await browser.waitForTarget((t) => t.type() === 'service_worker');
const swc = await sw.createCDPSession();
await swc.send('Network.enable');
await swc.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const fails = [];
page.on('requestfailed', (r) => fails.push(r.url() + ' ' + (r.failure()?.errorText ?? '')));
page.on('console', (m) => fails.push('console: ' + m.text()));
browser.on('targetcreated', async (t) => { if (t.type() === 'worker') fails.push('worker ' + t.url()); });
await page.goto(base + '/luaj/', { waitUntil: 'domcontentloaded' });
const title = await page.title();
ok(title.startsWith('Luaj'), 'the play page loads offline', title);
const ready = await page.waitForFunction(() => document.querySelector('[data-status]')?.textContent?.includes('Radha jote'), { timeout: 30000 }).then(() => true, () => false);
ok(ready, 'the engine loads offline', ready ? '' : (await page.$eval('[data-status]', (e) => e.textContent)) + ' / ' + fails.slice(0, 8).join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nworks offline');
process.exit(failed ? 1 : 0);
