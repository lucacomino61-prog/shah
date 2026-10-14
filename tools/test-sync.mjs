// Sync between two phones (two headless Chrome profiles) through the local server: one turns it on and gets a code,
// the other joins from the shared link, both end up with the joined progress, a change on one reaches the other,
// what the server keeps is unreadable without the code, and wiping the server copy stops sync on both.
// Needs the dev server (3770) and the local server (8787). node tools/test-sync.mjs [base]
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
  args: ['--hide-scrollbars'],
});
const errors = [];
async function phone(label, progress) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  await page.goto(base + '/404.html');
  await page.evaluate((p) => localStorage.setItem('shah.progress.v1', JSON.stringify(p)), progress);
  return page;
}
const progress = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('shah.progress.v1') || '{}'));
const syncState = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('shah.sync') || 'null'));
const note = (p) => p.$eval('[data-sync-note]', (e) => e.textContent);
const game = (date, result) => ({ date, side: 'w', level: 2, result, moves: 30, accuracy: 80, blunders: 0, mistakes: 1, opening: null });

const A = await phone('A', { games: [game('2026-10-10T10:00:00.000Z', 'win')], lessons: ['piruni'], puzzleRating: 1040, puzzlesSolved: 30, puzzlesTried: 41, rushBest: 12, updated: '2026-10-14T08:00:00.000Z' });
const B = await phone('B', { games: [game('2026-10-12T10:00:00.000Z', 'draw')], lessons: ['lidhja'], puzzleRating: 990, puzzlesSolved: 5, puzzlesTried: 9, rushBest: 3, updated: '2026-10-14T07:00:00.000Z' });

// A turns sync on
await A.goto(base + '/progresi/', { waitUntil: 'networkidle0' });
await A.evaluate(() => document.querySelector('[data-sync-start]').click());
await A.waitForFunction(() => !document.querySelector('[data-sync-on]').hidden, { timeout: 15000 }).catch(() => {});
const sa = await syncState(A);
const shown = await A.$eval('[data-sync-code]', (e) => e.textContent);
ok(sa && /^[A-Z2-9]{16}$/.test(sa.code) && sa.rev === 1 && shown === sa.code.match(/.{4}/g).join('-'), 'sync on: a 16-letter code, shown in fours, and the first copy on the server', shown);
const lede = await A.$eval('[data-lede]', (e) => e.textContent);
ok(lede.includes('e koduar'), 'the page no longer says the progress lives only here', lede);

// what the server holds cannot be read without the code
const id = await A.evaluate(async (code) => {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('shah-sync-id:' + code));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
}, sa.code);
const raw = await (await fetch(`http://127.0.0.1:8787/sync/${id}`)).json();
ok(raw.rev === 1 && !raw.blob.includes('piruni') && !Buffer.from(raw.blob, 'base64').toString('latin1').includes('piruni'), 'the server copy is ciphertext: no lesson names, no numbers in clear');

// B joins from the shared link
await B.goto(`${base}/progresi/#sync=${sa.code}`, { waitUntil: 'networkidle0' });
const prefilled = await B.$eval('[data-sync-join] input', (e) => e.value);
ok(prefilled === shown && (await B.evaluate(() => location.hash)) === '', 'the link fills in the code and leaves the address bar clean', prefilled);
await B.evaluate(() => document.querySelector('[data-sync-join] button[type="submit"]').click());
await B.waitForFunction(() => !document.querySelector('[data-sync-on]').hidden, { timeout: 15000 }).catch(() => {});
let pb = await progress(B);
ok(pb.games?.length === 2 && pb.lessons.join(',') === 'lidhja,piruni' && pb.puzzleRating === 1040 && pb.rushBest === 12, 'B now holds both phones’ progress', `${pb.games?.length} games, ${pb.lessons?.join(',')}, ${pb.puzzleRating}`);
ok((await note(B)).includes('U lidh'), 'and says so', await note(B));
const summary = await B.$$eval('[data-summary] dd', (l) => l.map((e) => e.textContent));
ok(summary[0].startsWith('2 '), 'the summary on the page is drawn again with both games', summary[0]);

// A picks up B's half on its next look
await A.reload({ waitUntil: 'networkidle0' });
await A.waitForFunction(() => JSON.parse(localStorage.getItem('shah.progress.v1')).games.length === 2, { timeout: 10000 }).catch(() => {});
let pa = await progress(A);
ok(pa.games.length === 2 && pa.lessons.includes('lidhja'), 'A pulls the joined copy when it opens');

// a change on B reaches A: the sound switch, a setting, so the newer phone's value wins
const before = pa.sound;
await B.evaluate(() => document.querySelector('[data-sound]').click());
await sleep(4500);
await A.reload({ waitUntil: 'networkidle0' });
await A.waitForFunction((v) => JSON.parse(localStorage.getItem('shah.progress.v1')).sound !== v, { timeout: 10000 }, before).catch(() => {});
pa = await progress(A);
ok(pa.sound === !before, 'a setting changed on B arrives on A a few seconds later', `${before} -> ${pa.sound}`);

// both agree and stop sending: a sync now on each is a no-op
const revBefore = (await syncState(A)).rev;
await A.evaluate(() => document.querySelector('[data-sync-now]').click());
await sleep(1200);
await B.evaluate(() => document.querySelector('[data-sync-now]').click());
await sleep(1200);
const revAfter = (await (await fetch(`http://127.0.0.1:8787/sync/${id}`)).json()).rev;
ok(revAfter === revBefore, 'once both agree, nothing more is sent', `${revBefore} -> ${revAfter}`);

// wiping the server copy on A stops sync on B too
await A.evaluate(() => document.querySelector('[data-sync-wipe]').click());
await A.evaluate(() => document.querySelector('[data-sync-wipe]').click());
await sleep(1000);
ok((await syncState(A)) === null && (await fetch(`http://127.0.0.1:8787/sync/${id}`)).status === 404, 'the wipe deletes the server copy and turns sync off');
await B.evaluate(() => document.querySelector('[data-sync-now]').click());
await sleep(1500);
const bNote = await note(B);
ok((await syncState(B)) === null && (await B.$eval('[data-sync-off]', (e) => !e.hidden)) && bNote.includes('u fshi'), 'the other phone finds it gone and stops too, keeping its progress', bNote);
pb = await progress(B);
ok(pb.games.length === 2, 'B keeps its games');
ok((await fetch(`http://127.0.0.1:8787/sync/${id}`)).status === 404, 'and does not put the copy back');

// a wrong code is named as such
await B.evaluate(() => document.querySelector('[data-sync-join-open]').click());
await B.type('[data-sync-join] input', 'ABCD-EFGH-JKMN-PQRS');
await B.evaluate(() => document.querySelector('[data-sync-join] button[type="submit"]').click());
await sleep(1200);
ok((await note(B)).includes('nuk u gjet'), 'a code that does not exist is told apart', await note(B));

await browser.close();
ok(!errors.length, 'no page errors', errors.join(' / '));
console.log(failed ? `\n${failed} FAILED` : '\nsync works');
process.exit(failed ? 1 : 0);
