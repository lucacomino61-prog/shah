// The club: the first-visit question, the deck of player cards, the opponent's seat and voice, the course and the
// progress page drawn from stored progress (dev server running).
//   node tools/test-club.mjs [base]
import puppeteer from 'puppeteer-core';

const base = process.argv[2] ?? 'http://127.0.0.1:3770';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
let failed = 0;
const ok = (cond, label, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};
const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem('shah.progress.v1') ?? '{}'));

// a newcomer: one question, an answer is needed, and it picks the opponent and the lesson
await page.goto(base + '/404.html');
await page.evaluate((t) => { localStorage.clear(); localStorage.setItem('shah.unboxed', t); }, today);
await page.goto(base + '/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => document.querySelector('[data-welcome]')?.open, { timeout: 20000 }).catch(() => {});
ok(await page.evaluate(() => document.querySelector('[data-welcome]').open), 'a newcomer is asked how well they know the game');
await page.evaluate(() => document.querySelector('[data-welcome] button[value="play"]').click());
await sleep(300);
ok(await page.evaluate(() => !document.querySelector('[data-welcome-err]').hidden), 'starting without an answer says to pick one');
await page.click('[data-welcome] input[value="some"]');
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.evaluate(() => document.querySelector('[data-welcome] button[value="lesson"]').click())]);
ok(new URL(page.url()).pathname === '/mesime/piruni/', 'the lesson answer opens its first lesson', page.url());
ok((await store()).level === 9, 'and seats Arta as the opponent', String((await store()).level));
await page.goto(base + '/', { waitUntil: 'networkidle0' });
await sleep(2500);
ok(await page.evaluate(() => !document.querySelector('[data-welcome]').open), 'the question is asked only once');
ok((await page.$eval('[data-opp-name]', (e) => e.textContent)) === 'Arta', 'the home screen names the next opponent', await page.$eval('[data-opp-name]', (e) => e.textContent));

// the deck: a card per opponent with the record against them; the choice is seated with its face, and says hello
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('shah.progress.v1'));
  p.games = [{ date: '2026-10-10T10:00:00Z', side: 'w', level: 9, result: 'win', moves: 30, accuracy: 80, blunders: 0, mistakes: 1, opening: null }];
  localStorage.setItem('shah.progress.v1', JSON.stringify(p));
});
await page.goto(base + '/luaj/', { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__play && window.__play.engine() === 'ready', { timeout: 60000 });
ok(await page.evaluate(() => !document.querySelector('[data-face]').hidden && document.querySelector('[data-face]').src.includes('/bots/arta-face')), 'the opponent sits in the score capsule with her face');
await page.evaluate(() => document.querySelector('[data-new]').click());
await sleep(500);
const cards = await page.$$eval('.deck .card', (l) => l.map((c) => c.querySelector('.card__name').textContent + ':' + c.querySelector('.card__score').textContent));
ok(cards.length === 9, 'the deck holds the nine opponents', String(cards.length));
ok(cards.includes('Arta:1 fitore, 0 humbje') || cards.some((c) => c.startsWith('Arta:1 fitore')), 'each card shows the record against that opponent', cards.find((c) => c.startsWith('Arta')));
await page.click('input[name="level"][value="2"]');
await page.evaluate(() => document.querySelector('.setup button[type="submit"]').click());
await sleep(1600);
const seat = await page.evaluate(() => ({ face: document.querySelector('[data-face]').src, say: document.querySelector('[data-say]').hidden ? null : document.querySelector('[data-say-text]').textContent, flights: document.querySelectorAll('.seat-flight').length }));
ok(seat.face.includes('/bots/drita-face'), 'the chosen card takes the seat', seat.face);
ok(!!seat.say, 'and the new opponent says hello', seat.say ?? '');
ok(seat.flights === 0, 'the flying card is gone once it lands');

// the course: done lessons on the path, the next one marked
await page.evaluate(() => {
  const p = JSON.parse(localStorage.getItem('shah.progress.v1'));
  // the whole first chapter (Bazat) done: the next lesson is the first of Taktikat
  p.lessons = ['vlera-e-figurave', 'rokada', 'marrja-ne-kalim', 'promovimi', 'parimet-e-hapjes'];
  localStorage.setItem('shah.progress.v1', JSON.stringify(p));
});
await page.goto(base + '/mesime/', { waitUntil: 'networkidle0' });
const path = await page.evaluate(() => ({
  done: [...document.querySelectorAll('[data-state="done"]')].map((e) => e.dataset.lesson),
  next: document.querySelector('[data-state="next"]')?.dataset.lesson,
  go: document.querySelector('[data-next-link]').getAttribute('href'),
  diagrams: document.querySelectorAll('.stop .mini use').length,
}));
ok(path.done.join(',') === 'vlera-e-figurave,rokada,marrja-ne-kalim,promovimi,parimet-e-hapjes', 'the course shows the lessons done', path.done.join(','));
ok(path.next === 'piruni' && path.go === '/mesime/piruni/', 'and the next one, where the button leads', `${path.next} ${path.go}`);
ok(path.diagrams > 50, 'every stop carries a diagram with its pieces', String(path.diagrams));

// progress: figures, the ladder and the medals from what is stored
await page.goto(base + '/progresi/', { waitUntil: 'networkidle0' });
const pr = await page.evaluate(() => ({
  games: document.querySelector('[data-fig="games"]').textContent,
  arta: document.querySelector('[data-rung="9"] [data-score]').textContent,
  first: document.querySelector('[data-badge="first-win"]').hasAttribute('data-earned'),
  lessons: document.querySelector('[data-badge="lesson-1"]').hasAttribute('data-earned'),
  streak: document.querySelector('[data-badge="streak-7"]').hasAttribute('data-earned'),
  dots: document.querySelectorAll('[data-acc-chart] .dot').length,
}));
ok(pr.games === '1' && pr.arta === '1 – 0 – 0', 'the figures and the ladder count the stored game', `${pr.games} / ${pr.arta}`);
ok(pr.first && pr.lessons && !pr.streak, 'medals are earned only by what the progress shows', JSON.stringify(pr));
ok(pr.dots === 1, 'the accuracy chart has a dot per game', String(pr.dots));

ok(!errors.length, 'no page errors', errors.join(' | '));
await browser.close();
console.log(failed ? `\n${failed} FAILED` : '\nthe club holds');
process.exit(failed ? 1 : 0);
