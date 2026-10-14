// The home page: the board on its table under the lamp, the camera swinging slowly round it, and a programme
// guide for today that knows where the learner stopped.

import { LESSONS } from '../data/lessons.ts';
import { levelOf } from '../lib/levels.ts';
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
  board.setPosition('8/8/8/8/8/8/8/8 w - - 0 1', false);
  // the pieces walk on from the edge of the table
  setTimeout(() => board.setPosition(START, true), 250);
  board.orbit?.(motionOn() ? 0.12 : 0);
  onMotion((on) => {
    board.setMotion(on);
    board.orbit?.(on ? 0.12 : 0);
  });
  onTick((dt) => board.tick(dt));
})();
