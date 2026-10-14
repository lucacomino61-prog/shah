// The home page: the board on its table under the lamp, the camera swinging slowly round it, and a programme
// guide for today that knows where the learner stopped. On the first visit of the day the board lies shut in its
// case: a tap opens it (with its sounds and a vibration, which a browser allows only after a touch), the pieces come
// out of the seam one by one onto their squares, and the rest of the page rises in after them.

import { LESSONS } from '../data/lessons.ts';
import { levelOf } from '../lib/levels.ts';
import { haptic } from '../lib/sound.ts';
import { rollStreak } from './celebrate.ts';
import { dueCards, load, loadGame, streakNow, today } from '../lib/store.ts';
import { createBoard } from './board/index.ts';
import { motionOn, onMotion, onTick } from './shell.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// the programme, drawn again when sync brings in another phone's progress
function programme() {
  const prefs = load();
  const saved = loadGame();
  if (saved && saved.ucis.length) {
    $('[data-game-title]').textContent = 'Vazhdo lojën';
    $('[data-game-line]').textContent = `Lëvizja ${Math.ceil(saved.sans.length / 2)}, niveli ${saved.level}. Loja të pret.`;
    $('[data-go-label]').textContent = 'Vazhdo lojën';
  } else {
    const lv = levelOf(prefs.level);
    $('[data-game-line]').textContent = `Niveli ${lv.n}, ${lv.name.toLowerCase()}. Ti me ${prefs.side === 'b' ? 'të zezat' : 'të bardhat'}.`;
  }
  // the streak beside Luaj, and today's puzzle first in the programme until it is solved
  const streak = streakNow(prefs);
  if (streak) {
    $('[data-streak]').hidden = false;
    $('[data-streak-n]').textContent = String(streak);
    $('[data-streak-word]').textContent = streak === 1 ? 'ditë' : 'ditë rresht';
    $('[data-streak]').setAttribute('aria-label', `${streak} ${streak === 1 ? 'ditë' : 'ditë rresht'} me ushtrimin e ditës`);
  }
  const dailyOpen = !(prefs.daily?.date === today() && prefs.daily.solved);
  const due = dueCards(prefs).length;
  if (dailyOpen) {
    $<HTMLAnchorElement>('[data-puzzle-link]').href = '/ushtrime/?tema=dita';
    $('[data-puzzle-title]').textContent = 'Ushtrimi i ditës';
  } else if (due) {
    $<HTMLAnchorElement>('[data-puzzle-link]').href = '/ushtrime/?tema=gabimet';
    $('[data-puzzle-title]').textContent = 'Gabimet e tua';
  }
  $('[data-puzzle-line]').textContent = dailyOpen
    ? streak
      ? `${streak === 1 ? '1 ditë' : `${streak} ditë rresht`}. Mos e humb serinë.`
      : 'Një ushtrim i ri çdo ditë. Fillo serinë.'
    : due
    ? `${due} gabime nga lojërat e tua presin sot.`
    : prefs.puzzlesTried
    ? `Vlerësimi yt: ${prefs.puzzleRating}. Të zgjidhura: ${prefs.puzzlesSolved}.`
    : 'Fillo me ushtrimet e para: pirun, lidhje, mat.';
  const nextLesson = LESSONS.find((l) => !prefs.lessons.includes(l.slug)) ?? LESSONS[0];
  $<HTMLAnchorElement>('[data-lesson-link]').href = `/mesime/${nextLesson.slug}/`;
  $('[data-lesson-line]').textContent = nextLesson.title;
}
programme();
window.addEventListener('shah:synced', programme);

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
  board.setAngle?.(2);
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
    streakRoll();
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
