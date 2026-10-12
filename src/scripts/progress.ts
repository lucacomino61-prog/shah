// The progress page, read from this browser's storage.

import { TAG_NAMES, type Tag } from '../lib/coach.ts';
import { LESSONS } from '../data/lessons.ts';
import { levelOf } from '../lib/levels.ts';
import { load, save, saveGame } from '../lib/store.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const p = load();
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// which lesson answers which mistake
const CURE: Record<Tag, { href: string; label: string }> = {
  hanging: { href: '/mesime/vlera-e-figurave/', label: 'Mësimi: Vlera e figurave' },
  'lost-material': { href: '/mesime/vlera-e-figurave/', label: 'Mësimi: Vlera e figurave' },
  'missed-capture': { href: '/ushtrime/', label: 'Ushtrime: Figura pa mbrojtje' },
  'allowed-fork': { href: '/mesime/piruni/', label: 'Mësimi: Piruni' },
  'missed-fork': { href: '/mesime/piruni/', label: 'Mësimi: Piruni' },
  'allowed-mate': { href: '/mesime/mat-ne-rreshtin-e-fundit/', label: 'Mësimi: Mat në rreshtin e fundit' },
  'missed-mate': { href: '/mesime/mati-me-dy-torra/', label: 'Mësimi: Mati me dy torra' },
  'early-queen': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'same-piece': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'rim-knight': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
  'f-pawn': { href: '/mesime/parimet-e-hapjes/', label: 'Mësimi: Parimet e hapjes' },
};

const wins = p.games.filter((g) => g.result === 'win').length;
const draws = p.games.filter((g) => g.result === 'draw').length;
const losses = p.games.length - wins - draws;
const acc = p.games.filter((g) => g.accuracy !== null);
const avg = acc.length ? Math.round(acc.reduce((s, g) => s + (g.accuracy ?? 0), 0) / acc.length) : null;
const rows: [string, string][] = [
  ['Lojëra', p.games.length ? `${p.games.length} (${wins} fitore, ${draws} barazime, ${losses} humbje)` : '0'],
  ['Saktësia mesatare', avg === null ? 'Ende pa lojëra' : `${avg}%`],
  [p.puzzlesTried ? 'Vlerësimi në ushtrime' : 'Vlerësimi fillestar në ushtrime', String(p.puzzleRating)],
  ['Ushtrime të zgjidhura pa ndihmë', `${p.puzzlesSolved} nga ${p.puzzlesTried}`],
  ['Mësime të kryera', `${p.lessons.length} nga ${LESSONS.length}`],
];
$('[data-summary]').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('');

const tags = (Object.entries(p.tags) as [Tag, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
$('[data-mistakes]').innerHTML = tags.length
  ? tags
      .map(([t, n]) => `<li><b>${TAG_NAMES[t]}</b><span class="n">${n}</span><a href="${CURE[t].href}">${CURE[t].label}</a></li>`)
      .join('')
  : `<li class="empty">Ende asnjë gabim i numëruar. Pas lojës së parë, trajneri do t’i mbledhë këtu. <a href="/luaj/">Luaj një lojë</a></li>`;

const fmt = new Intl.DateTimeFormat('sq-AL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const RES = { win: 'Fitore', loss: 'Humbje', draw: 'Barazim', resigned: 'Dorëzim' } as const;
$('[data-games]').innerHTML = p.games.length
  ? [...p.games]
      .reverse()
      .slice(0, 12)
      .map((g) => {
        let when = g.date.slice(0, 10);
        try {
          when = fmt.format(new Date(g.date));
        } catch {
          /* keep the ISO date */
        }
        const lv = levelOf(g.level);
        return `<li><span>${esc(when)}, ${g.side === 'w' ? 'të bardhat' : 'të zezat'}, niveli ${lv.n}</span><span class="res" data-r="${g.result}">${RES[g.result]}</span><span class="meta">${g.moves} lëvizje${g.accuracy !== null ? `, saktësia ${g.accuracy}%` : ''}${g.blunders ? `, ${g.blunders} gabime të rënda` : ''}${g.opening ? `, ${esc(g.opening)}` : ''}</span></li>`;
      })
      .join('')
  : `<li class="empty">Ende asnjë lojë e mbaruar. <a href="/luaj/">Luaj të parën</a></li>`;

// clearing everything takes two presses
const reset = $<HTMLButtonElement>('[data-reset]');
let armed: ReturnType<typeof setTimeout> | null = null;
reset.addEventListener('click', () => {
  const label = reset.querySelector('[data-label]')!;
  if (!armed) {
    label.textContent = 'Shtyp përsëri për ta fshirë';
    armed = setTimeout(() => {
      label.textContent = 'Fshi progresin';
      armed = null;
    }, 4000);
    return;
  }
  clearTimeout(armed);
  armed = null;
  save({ ...p, games: [], puzzleRating: 900, puzzlesSolved: 0, puzzlesTried: 0, seen: [], tags: {}, lessons: [] });
  saveGame(null);
  location.reload();
});
