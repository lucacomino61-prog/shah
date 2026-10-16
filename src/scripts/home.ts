// The home page: the board on its table under the lamp, the camera swinging slowly round it, and a programme
// guide for today that knows where the learner stopped. On the first visit of the day the board lies shut in its
// case: a tap opens it (with its sounds and a vibration, which a browser allows only after a touch), the pieces come
// out of the seam one by one onto their squares, and the rest of the page rises in after them.

import { COURSE, COURSE_ORDER, nextLesson } from '../data/lessons.ts';
import { levelOf } from '../lib/levels.ts';
import { persona, portrait } from '../lib/bots.ts';
import { pickDaily } from '../lib/daily.ts';
import { miniBoard } from '../lib/miniboard.ts';
import { scoreVs } from '../lib/record.ts';
import { haptic } from '../lib/sound.ts';
import { rollStreak } from './celebrate.ts';
import { dueCards, load, loadGame, streakNow, today, update } from '../lib/store.ts';
import { createBoard } from './board/index.ts';
import { motionOn, onMotion, onTick } from './shell.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// the dashboard, drawn again when sync brings in another phone's progress
function programme() {
  const prefs = load();
  const saved = loadGame();
  // who sits across: the game that waits, or the next opponent with the learner's score against them
  const playing = !!(saved && saved.ucis.length);
  const lv = levelOf(playing ? saved!.level : prefs.level);
  const friend = playing && saved!.friend;
  const face = $<HTMLImageElement>('[data-opp-face]');
  face.src = portrait(lv.id, 320);
  face.hidden = !!friend;
  $('[data-opp-name]').textContent = friend ? 'Dy lojtarë' : lv.bot;
  if (playing) {
    $('[data-opp-k]').textContent = 'Loja të pret';
    $('[data-opp-meta]').textContent = `Lëvizja ${Math.ceil(saved!.sans.length / 2)}, ti me ${saved!.side === 'b' ? 'të zezat' : 'të bardhat'}`;
    $('[data-go-label]').textContent = 'Vazhdo lojën';
    const board = $('[data-opp-board]');
    board.innerHTML = miniBoard(saved!.fens[saved!.fens.length - 1], { side: saved!.side });
    board.hidden = false;
  } else {
    $('[data-opp-k]').textContent = 'Kundërshtari yt';
    const sc = scoreVs(prefs, lv.id);
    const n = sc.won + sc.drawn + sc.lost;
    $('[data-opp-meta]').textContent = `Niveli ${lv.n} · ${n ? `${sc.won} – ${sc.drawn} – ${sc.lost}` : persona(lv.id).tagline}`;
    $('[data-opp-board]').hidden = true;
  }
  $('[data-opp]').setAttribute('aria-label', playing ? `Vazhdo lojën: ${$('[data-opp-meta]').textContent}` : `Luaj. Kundërshtari: ${lv.bot}, niveli ${lv.n}.`);
  // the streak beside Luaj
  const streak = streakNow(prefs);
  if (streak) {
    $('[data-streak]').hidden = false;
    $('[data-streak-n]').textContent = String(streak);
    $('[data-streak-word]').textContent = streak === 1 ? 'ditë' : 'ditë rresht';
    $('[data-streak]').setAttribute('aria-label', `${streak} ${streak === 1 ? 'ditë' : 'ditë rresht'} me ushtrimin e ditës`);
  }
  // today's puzzle as a diagram until it is solved; then the learner's own mistakes, when some are due
  const dailyOpen = !(prefs.daily?.date === today() && prefs.daily.solved);
  const due = dueCards(prefs).length;
  const link = $<HTMLAnchorElement>('[data-puzzle-link]');
  if (dailyOpen) {
    link.href = '/ushtrime/?tema=dita';
    $('[data-puzzle-title]').textContent = 'Ushtrimi i ditës';
    $('[data-puzzle-line]').textContent = streak ? `Seria: ${streak} ditë` : 'Fillo serinë sot';
    void dailyBoard(prefs.puzzleRating);
  } else {
    link.href = due ? '/ushtrime/?tema=gabimet' : '/ushtrime/';
    $('[data-puzzle-title]').textContent = due ? 'Gabimet e tua' : 'Ushtrimi i ditës';
    $('[data-puzzle-line]').textContent = due ? `${due} presin sot` : 'U zgjidh sot';
    $('[data-daily-board]').innerHTML = '';
  }
  // the next lesson on the course, with how far along the course is
  const next = nextLesson(prefs.lessons);
  const done = COURSE_ORDER.filter((l) => prefs.lessons.includes(l.slug)).length;
  $<HTMLAnchorElement>('[data-lesson-link]').href = `/mesime/${next.slug}/`;
  $('[data-lesson-line]').textContent = next.title;
  $('[data-lesson-chapter]').textContent = COURSE.find((c) => c.lessons.includes(next))?.n ?? 'I';
  $('[data-lesson-bar]').style.transform = `scaleX(${done / COURSE_ORDER.length})`;
}

/** Today's puzzle as a small diagram: the position the learner will face (the opponent's setup move played). The
 *  puzzles load on their own, after the page, so the home screen does not wait for them. */
async function dailyBoard(rating: number) {
  const prefs = load();
  const { default: all } = await import('../data/puzzles.json');
  const list = all as { id: string; fen: string; moves: string[]; rating: number }[];
  const kept = prefs.daily?.date === today() ? list.find((p) => p.id === prefs.daily!.id) : undefined;
  const p = kept ?? pickDaily(list, rating, today());
  const { Chess } = await import('chess.js');
  const c = new Chess(p.fen);
  const m = c.move({ from: p.moves[0].slice(0, 2), to: p.moves[0].slice(2, 4), promotion: p.moves[0][4] || undefined });
  $('[data-daily-board]').innerHTML = miniBoard(c.fen(), { side: c.turn(), marks: [m.from, m.to] });
}

programme();
window.addEventListener('shah:synced', programme);

/** While the case is shut, what waits under it cannot take focus (it is invisible until the board is set). */
function shut(on: boolean) {
  document.querySelectorAll<HTMLElement>('.home [data-board-ui]').forEach((e) => (e.inert = on));
}
if ('hasUnbox' in document.documentElement.dataset) shut(true);

/** the streak as this page last showed it: when it has grown since, the number rolls up and the flame jumps */
function streakRoll() {
  const n = streakNow(load());
  let seen: string | null = null;
  try {
    seen = localStorage.getItem('shah.streak.seen');
    localStorage.setItem('shah.streak.seen', String(n));
  } catch {
    /* no memory of it: no roll */
  }
  if (seen !== null && n > Number(seen) && n > 0) rollStreak($('[data-streak-n]'), Number(seen), n, document.querySelector('[data-streak] .icon'));
}

(async () => {
  const board = await createBoard('3d', {
    host: $('[data-board]'),
    orientation: 'w',
    motion: motionOn,
    dests: () => [],
    onMove: () => {},
    label: 'Tabela',
  });
  board.setInteractive(false);
  board.setCinema?.(true);
  board.orbit?.(motionOn() ? 0.12 : 0);
  const html = document.documentElement;
  const gate = $('[data-unbox]');
  const host = $('[data-board]');
  const remember = () => {
    try {
      localStorage.setItem('shah.unboxed', today());
    } catch {
      /* it opens again next time */
    }
  };
  const reveal = () => {
    remember();
    delete html.dataset.hasUnbox;
    shut(false);
    streakRoll();
    welcome();
  };
  if (!('hasUnbox' in html.dataset) || !board.unbox || !board.fold) {
    // a later visit today (or no case to open): the board is set
    board.setPosition(START, false);
    reveal();
  } else {
    board.fold(true);
    host.style.opacity = '1';
    let skip: (() => void) | null = null;
    const open = () => {
      if (gate.hasAttribute('data-opening')) return;
      gate.setAttribute('data-opening', '');
      // inside the touch: the one moment an iPhone allows a haptic tick
      haptic(12);
      remember();
      skip = board.unbox!(START, { done: () => {
        skip = null;
        reveal();
      } });
    };
    const skipAll = () => {
      if (skip) return skip();
      board.fold!(false);
      board.setPosition(START, false);
      reveal();
    };
    $('[data-unbox-open]').addEventListener('click', open);
    // from here the page answers the tap itself; a tap that came while the table was loading opens it now
    html.dataset.unboxReady = '';
    if ('unboxWanted' in html.dataset) requestAnimationFrame(() => requestAnimationFrame(open));
    $('[data-unbox-skip]').addEventListener('click', (e) => {
      e.stopPropagation();
      skipAll();
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && 'hasUnbox' in html.dataset) skipAll();
    });
    onMotion((on) => {
      if (!on) skipAll();
    });
  }
  onMotion((on) => {
    board.setMotion(on);
    board.orbit?.(on ? 0.12 : 0);
  });
  onTick((dt) => board.tick(dt));
})();

/** The first visit: one question picks the first opponent and the first lesson. Only for a newcomer (nothing played,
 *  read or solved yet), and only once on this phone. */
function welcome() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-welcome]');
  if (!dialog || dialog.open) return;
  const p = load();
  let seen: string | null = 'done';
  try {
    seen = localStorage.getItem('shah.welcome');
  } catch {
    /* storage blocked: do not ask on every visit */
  }
  if (seen || p.games.length || p.lessons.length || p.puzzlesTried) return;
  const form = dialog.querySelector<HTMLFormElement>('[data-welcome-form]')!;
  const err = dialog.querySelector<HTMLElement>('[data-welcome-err]')!;
  const mark = () => {
    try {
      localStorage.setItem('shah.welcome', 'done');
    } catch {
      /* as above */
    }
  };
  setTimeout(() => {
    dialog.showModal();
    dialog.querySelector<HTMLElement>('#welcome-title')?.focus();
  }, motionOn() ? 500 : 0);
  form.addEventListener('change', () => (err.hidden = true));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const choice = form.querySelector<HTMLInputElement>('input[name="start"]:checked');
    if (!choice) {
      err.hidden = false;
      form.querySelector<HTMLInputElement>('input[name="start"]')!.focus();
      return;
    }
    const go = (e.submitter as HTMLButtonElement | null)?.value === 'lesson' ? `/mesime/${choice.dataset.lesson}/` : '/luaj/';
    update((x) => (x.level = Number(choice.dataset.level)));
    mark();
    location.href = go;
  });
  dialog.querySelector('[data-welcome-later]')!.addEventListener('click', () => {
    mark();
    dialog.close();
  });
  dialog.addEventListener('cancel', mark);
}
