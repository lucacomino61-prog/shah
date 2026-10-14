// After a deploy: the live site with the live server, in two headless Chrome profiles (two phones). The board opens
// from its case on the first visit, a game online between the two (made from the play sheet, joined by the link,
// one move each by keyboard, a resignation), sync between the two (turned on, joined by the link, the copy wiped),
// and the reminder section present. No dev hooks here: everything goes through the page as a person would.
// node tools/test-live.mjs [base]
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'https://shah-trajneri.pages.dev';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
const ok = (c, label, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  protocolTimeout: 60000,
  args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--hide-scrollbars'],
});
const errors = [];
async function phone(label) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  return page;
}
const text = (p, sel) => p.$eval(sel, (e) => e.textContent.trim()).catch(() => '');
const waitText = async (p, sel, re, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = await text(p, sel);
    if (re.test(t)) return t;
    await sleep(250);
  }
  return text(p, sel);
};
/** a move by keyboard: the cursor starts on the e-pawn of the side at the near edge */
async function pushPawn(p) {
  await p.focus('[data-board]');
  await p.keyboard.press('Enter');
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('ArrowUp');
  await p.keyboard.press('Enter');
}

// ------------------------------------------------------------------ the opening
const A = await phone('A');
await A.goto(base + '/', { waitUntil: 'networkidle0' });
await A.waitForSelector('[data-board] canvas', { timeout: 30000 });
ok(await A.evaluate(() => 'hasUnbox' in document.documentElement.dataset), 'first visit: the board lies shut with “Prek për ta hapur”');
await A.evaluate(() => document.querySelector('[data-unbox-open]').click());
await A.waitForFunction(() => !('hasUnbox' in document.documentElement.dataset), { timeout: 20000 }).catch(() => {});
ok(!(await A.evaluate(() => 'hasUnbox' in document.documentElement.dataset)), 'a tap opens it and the page rises in');

// ------------------------------------------------------------------ a game online
await A.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await A.evaluate(() => document.querySelector('[data-new]').click());
await sleep(800);
await A.evaluate(() => {
  document.querySelector('input[name="opponent"][value="online"]').click();
  document.querySelector('input[name="side"][value="w"]').click();
  document.querySelector('input[name="clock"][value="none"]').click();
  document.querySelector('[data-setup] button[type="submit"]').click();
});
await A.waitForFunction(() => location.pathname === '/online/', { timeout: 20000 });
const code = await waitText(A, '[data-glyph]', /^[A-Z2-9]{4}$/);
ok(/^[A-Z2-9]{4}$/.test(code), 'the play sheet makes a room on the live server', code);
const B = await phone('B');
await B.goto(`${base}/online/?kod=${code}`, { waitUntil: 'networkidle0' });
const invite = await waitText(B, '[data-title]', /fton/);
ok(invite.includes('të zezat'), 'the link opens the invitation', invite);
await B.evaluate(() => document.querySelector('[data-act="join"]').click());
ok(/Radha jote/.test(await waitText(A, '[data-glyph]', /Radha jote/)) && /Radha e shokut/.test(await waitText(B, '[data-glyph]', /Radha e shokut/)), 'both phones are in the game');
await A.waitForSelector('[data-board] canvas', { timeout: 30000 });
await sleep(1500);
await pushPawn(A);
const seen = await waitText(B, '[data-title]', /e4/);
ok(seen.includes('e4'), 'White’s 1.e4 arrives on the other phone', seen);
await B.waitForSelector('[data-board] canvas', { timeout: 30000 });
await pushPawn(B);
ok((await waitText(A, '[data-title]', /e5/)).includes('e5'), 'and 1…e5 comes back');
await B.evaluate(() => {
  const r = document.querySelector('[data-act="resign"]');
  r.click();
  r.click();
});
ok((await waitText(A, '[data-glyph]', /Fitove/)) === 'Fitove' && (await waitText(B, '[data-glyph]', /Humbe/)) === 'Humbe', 'a resignation ends it on both');

// ------------------------------------------------------------------ sync
await A.goto(base + '/progresi/', { waitUntil: 'networkidle0' });
ok(await A.$('[data-remind-box]').then(Boolean), 'Progresi has the daily reminder');
await A.evaluate(() => document.querySelector('[data-sync-start]').click());
await A.waitForFunction(() => !document.querySelector('[data-sync-on]').hidden, { timeout: 20000 }).catch(() => {});
const sync = await A.evaluate(() => JSON.parse(localStorage.getItem('shah.sync') || 'null'));
ok(sync?.rev === 1, 'sync on: the first copy is on the server');
await B.goto(`${base}/progresi/#sync=${sync?.code}`, { waitUntil: 'networkidle0' });
await B.evaluate(() => document.querySelector('[data-sync-join] button[type="submit"]').click());
await B.waitForFunction(() => !document.querySelector('[data-sync-on]').hidden, { timeout: 20000 }).catch(() => {});
ok((await text(B, '[data-sync-note]')).includes('U lidh'), 'the other phone joins with the link', await text(B, '[data-sync-note]'));
// wipe the test copy
await A.evaluate(() => {
  const w = document.querySelector('[data-sync-wipe]');
  w.click();
  w.click();
});
await sleep(2000);
ok((await A.evaluate(() => localStorage.getItem('shah.sync'))) === null, 'the test copy is wiped from the server');

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nthe live site works');
process.exit(failed ? 1 : 0);
