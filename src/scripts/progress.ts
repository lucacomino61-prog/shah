// The progress page, read from this browser's storage and drawn again when sync brings in another phone's progress:
// one screen of pages (the overview, the club, the medals, the games). The settings have their own page (settings.ts).

import { TAG_NAMES, type Tag } from '../lib/coach.ts';
import { LESSONS } from '../data/lessons.ts';
import { CURE } from '../lib/cure.ts';
import { shareCard } from './share.ts';
import { levelOf } from '../lib/levels.ts';
import { portrait } from '../lib/bots.ts';
import { accuracies, badges, playingLevel, scores, scoreWords } from '../lib/record.ts';
import { countUp, settle } from './feel.ts';
import { load, streakNow, update } from '../lib/store.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
let p = load();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// which lesson answers which mistake

function render(first = false) {
  p = load();
  const wins = p.games.filter((g) => g.result === 'win').length;
  const draws = p.games.filter((g) => g.result === 'draw').length;
  const losses = p.games.length - wins - draws;
  const acc = p.games.filter((g) => g.accuracy !== null);
  const avg = acc.length ? Math.round(acc.reduce((s, g) => s + (g.accuracy ?? 0), 0) / acc.length) : null;
  // the three figures
  const fig = (k: string, n: string, sub: string) => {
    settle($(`[data-fig="${k}"]`));
    $(`[data-fig="${k}"]`).textContent = n;
    $(`[data-fig-sub="${k}"]`).textContent = sub;
  };
  fig('games', String(p.games.length), p.games.length ? `${wins} fitore` : 'Ende asnjë lojë');
  // under the count, the games split into won, drawn and lost (in words for a screen reader)
  const bar = $('[data-fig-bar]');
  bar.hidden = !p.games.length;
  for (const [k, n] of [['win', wins], ['draw', draws], ['loss', losses]] as const) bar.querySelector<HTMLElement>(`[data-part="${k}"]`)!.style.width = `${p.games.length ? (n / p.games.length) * 100 : 0}%`;
  if (p.games.length) $('[data-fig-sub="games"]').insertAdjacentHTML('beforeend', `<span class="visually-hidden">, ${draws} ${draws === 1 ? 'barazim' : 'barazime'}, ${losses} humbje</span>`);
  fig('acc', avg === null ? '–' : `${avg}%`, avg === null ? 'Pas lojës së parë' : 'mesatarja');
  fig('rating', String(p.puzzleRating), p.puzzlesTried ? `vlerësimi; ${p.puzzlesSolved} nga ${p.puzzlesTried} pa ndihmë` : 'vlerësimi fillestar');
  // on arrival the three figures count up to where they stand (a later redraw, after sync, sets them at once)
  if (first) {
    countUp($('[data-fig="games"]'), p.games.length);
    if (avg !== null) countUp($('[data-fig="acc"]'), avg, '%');
    countUp($('[data-fig="rating"]'), p.puzzleRating);
  }
  const mine = playingLevel(p);
  const rows: [string, string][] = [
    ['Mësime', `${LESSONS.filter((l) => p.lessons.includes(l.slug)).length} nga ${LESSONS.length}`],
    ['Seria', streakNow(p) ? `${streakNow(p)} ditë` : 'Pa filluar'],
    ['Niveli', mine.level ? `${mine.level.n} · ${mine.level.bot}` : 'Ende jo'],
  ];
  $('[data-summary]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');
  chart();
  ladder();
  medals();

  const tags = (Object.entries(p.tags) as [Tag, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  // the mistakes that keep coming back, over the games they came from; none yet, no card
  $('[data-cure]').hidden = !tags.length;
  $('[data-mistakes]').innerHTML = tags
    .slice(0, 3)
    .map(([t, n]) => `<li><b>${TAG_NAMES[t]}</b><span class="n">${n}</span><a href="${CURE[t].href}">${CURE[t].label}</a></li>`)
    .join('');

  // Chrome carries no Albanian date data (it would print "Oct 13"), so the months are written here
  const MONTHS = ['jan', 'shk', 'mar', 'pri', 'maj', 'qer', 'korr', 'gush', 'sht', 'tet', 'nën', 'dhj'];
  const fmt = { format: (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
  const RES = { win: 'Fitore', loss: 'Humbje', draw: 'Barazim', resigned: 'Dorëzim' } as const;
  $('[data-games]').innerHTML = p.games.length
    ? [...p.games]
        .reverse()
        .slice(0, 12)
        .map((g, i) => {
          let when = g.date.slice(0, 10);
          try {
            when = fmt.format(new Date(g.date));
          } catch {
            /* keep the ISO date */
          }
          const lv = levelOf(g.level);
          return `<li style="--i: ${i}"><span class="game__who"><img class="game__face" src="${portrait(lv.id)}" alt="" width="28" height="28" loading="lazy"><span>${esc(lv.bot)}</span></span><span class="res" data-r="${g.result}">${RES[g.result]}</span><span class="meta">${esc(when)}, ${g.side === 'w' ? 'të bardhat' : 'të zezat'}, ${g.moves} lëvizje${g.accuracy !== null ? `, saktësia ${g.accuracy}%` : ''}${g.blunders ? `, ${g.blunders} gabime të rënda` : ''}${g.opening ? `, ${esc(g.opening)}` : ''}</span></li>`;
        })
        .join('')
    : `<li class="empty">Ende asnjë lojë e mbaruar. <a href="/luaj/">Luaj të parën</a></li>`;
  fitGames();
}

/** The games page holds as many as fit: whole rows only, never a cut one, never a scroll. */
function fitGames() {
  const list = $('[data-games]');
  const box = list.parentElement!;
  list.querySelectorAll('li').forEach((li) => (li.hidden = false));
  const rows = [...list.querySelectorAll<HTMLElement>('li:not(.empty)')];
  for (let i = rows.length - 1; i > 0 && list.offsetHeight > box.clientHeight - 12; i--) rows[i].hidden = true;
}
/** Accuracy game by game: the trace, each game's dot in its result's colour, and the mean as a dotted line. */
function chart() {
  const svg = $<SVGSVGElement>('[data-acc-chart]');
  const cap = $('[data-acc-cap]');
  const pts = accuracies(p, 20);
  const empty = $('[data-acc-empty]');
  empty.hidden = pts.length > 0;
  if (!pts.length) {
    svg.innerHTML = '';
    svg.style.display = 'none';
    cap.textContent = 'Grafiku shfaqet pas lojës së parë.';
    return;
  }
  svg.style.display = '';
  const box = svg.getBoundingClientRect();
  const W = Math.round(box.width) || 400;
  const H = Math.round(box.height) || 168;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const L = 28;
  const R = 8;
  const T = 8;
  const B = 8;
  const x = (i: number) => (pts.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
  const y = (a: number) => T + ((100 - a) * (H - T - B)) / 100;
  const mean = Math.round(pts.reduce((s, q) => s + q.accuracy, 0) / pts.length);
  // the whole scale, down to its floor: the lower half is part of the reading, not empty space
  const grid = [100, 50, 0].map((v) => `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const trace = pts.length > 1 ? `<polyline class="trace" pathLength="1" points="${pts.map((q, i) => `${x(i).toFixed(1)},${y(q.accuracy).toFixed(1)}`).join(' ')}"/>` : '';
  const dots = pts.map((q, i) => `<circle class="dot" style="--i: ${i}" data-r="${q.result}" cx="${x(i).toFixed(1)}" cy="${y(q.accuracy).toFixed(1)}" r="4.5"/>`).join('');
  svg.innerHTML = `${grid}<line class="avg" x1="${L}" x2="${W - R}" y1="${y(mean)}" y2="${y(mean)}"/>${trace}${dots}`;
  const first = pts[0].accuracy;
  const last = pts[pts.length - 1].accuracy;
  cap.textContent =
    pts.length === 1
      ? `Një lojë, me saktësi ${last}%.`
      : `${pts.length} lojërat e fundit: nga ${first}% te ${last}%. Mesatarja ${mean}%.`;
}

/** The record against each opponent, easiest first. */
function ladder() {
  const mine = playingLevel(p);
  for (const { level: l, score: s } of scores(p)) {
    const row = document.querySelector<HTMLElement>(`[data-rung="${l.id}"]`);
    if (!row) continue;
    const n = s.won + s.drawn + s.lost;
    row.toggleAttribute('data-none', !n);
    // your level, and the one to beat next
    row.toggleAttribute('data-mine', mine.level?.id === l.id);
    row.toggleAttribute('data-next', mine.next?.id === l.id);
    row.querySelector('[data-lv]')!.textContent = mine.level?.id === l.id ? `Niveli ${l.n} · niveli yt` : mine.next?.id === l.id ? `Niveli ${l.n} · tjetri` : `Niveli ${l.n}`;
    row.querySelector('[data-pick]')!.setAttribute('aria-label', `${l.bot}, niveli ${l.n}: ${scoreWords(s)}. Zgjidhe për lojën e radhës.`);
    const out = row.querySelector<HTMLElement>('[data-score]')!;
    out.textContent = n ? `${s.won} – ${s.drawn} – ${s.lost}` : 'Ende pa lojë';
    out.setAttribute('aria-label', scoreWords(s));
    for (const [part, k] of [['win', s.won], ['draw', s.drawn], ['loss', s.lost]] as const)
      row.querySelector<HTMLElement>(`[data-part="${part}"]`)!.style.width = n ? `${(k / n) * 100}%` : '0';
  }
}

/** The medals: earned ones struck in brass; one won since the last visit is struck in front of the learner. */
function medals() {
  let seen: string[] = [];
  try {
    seen = (localStorage.getItem('shah.medals.seen') ?? '').split(',').filter(Boolean);
  } catch {
    /* no memory: nothing counts as new */
  }
  const all = badges(p);
  const earned = all.filter((b) => b.earned);
  for (const b of all) {
    const li = document.querySelector<HTMLElement>(`[data-badge="${b.id}"]`);
    if (!li) continue;
    li.toggleAttribute('data-earned', b.earned);
    li.toggleAttribute('data-new', b.earned && seen.length > 0 && !seen.includes(b.id));
    li.querySelector('[data-badge-state]')!.textContent = b.earned ? 'E fituar' : b.progress ? `${b.progress[0]} nga ${b.progress[1]}` : 'Ende jo';
  }
  $('[data-share-medals]').hidden = !earned.length;
  $('[data-medals-note]').textContent = earned.length
    ? `${earned.length} nga ${all.length} medalje të fituara. Fitohen me lojëra, ushtrime dhe mësime.`
    : 'Fitohen me lojëra, ushtrime dhe mësime. Askush nuk i jep falas.';
  try {
    // the first visit marks what is there already, so only medals won from now on are struck in front of the learner
    localStorage.setItem('shah.medals.seen', ['_', ...earned.map((b) => b.id)].join(','));
  } catch {
    /* as above */
  }
}

render(true);
window.addEventListener('shah:synced', () => render());
// a new size (a turned phone, a resized window): the chart and the games fit again
new ResizeObserver(() => {
  chart();
  fitGames();
}).observe($('.pager'));

// the ladder is the opponent picker too: a tap seats that opponent for the next game and opens the table (a game left
// unfinished is played out first)
document.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach((b) =>
  b.addEventListener('click', () => {
    update((x) => (x.level = Number(b.dataset.pick)));
    location.href = '/luaj/';
  }),
);

// the medals as a picture for friends: how many of the twelve, struck in brass
$<HTMLButtonElement>('[data-share-medals]').addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  const all = badges(p);
  const earned = all.filter((b) => b.earned);
  btn.disabled = true;
  try {
    await shareCard(
      { kicker: 'Medaljet', title: `${earned.length} nga ${all.length} medalje`, line: earned.slice(0, 4).map((b) => b.title).join(' · '), medals: { earned: earned.length, total: all.length } },
      `Kam fituar ${earned.length} nga ${all.length} medaljet në Shah. Provoje edhe ti:`,
    );
  } finally {
    btn.disabled = false;
  }
});
