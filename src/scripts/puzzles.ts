// Puzzles: a real position from the Lichess database, the opponent's last move played in front of the learner,
// then their turn. A wrong move is shown and taken back; a solved puzzle moves the puzzle rating.

import { Chess, type Square } from 'chess.js';
import puzzles from '../data/puzzles.json';
import { sanHtml, sentenceHtml, sentenceText } from '../lib/notation.ts';
import { load, ratePuzzle, update } from '../lib/store.ts';
import { THEMES, themeOf } from '../lib/themes.ts';
import { icon } from '../lib/icons.ts';
import { createBoard, followBroadcast, keyboard, type BoardView } from './board/index.ts';
import type { Side, Sq } from './board/types.ts';
import { gsap, motionOn, onMotion, onTick } from './shell.ts';

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  theme: string;
  themes: string[];
}
const ALL = puzzles as Puzzle[];

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const ui = {
  host: $('[data-board]'),
  status: $('[data-status]'),
  themeName: $('[data-theme-name]'),
  puzzleRating: $('[data-puzzle-rating]'),
  myRating: $('[data-my-rating]'),
  coach: $('[data-coach]'),
  glyph: $('[data-glyph]'),
  title: $('[data-title]'),
  reasons: $('[data-reasons]'),
  hint: $<HTMLButtonElement>('[data-hint]'),
  solution: $<HTMLButtonElement>('[data-solution]'),
  next: $<HTMLButtonElement>('[data-next]'),
  again: $<HTMLButtonElement>('[data-again]'),
  nextTool: $<HTMLButtonElement>('[data-next-puzzle]'),
  angle: $<HTMLButtonElement>('[data-angle]'),
  view: $<HTMLButtonElement>('[data-view]'),
  promo: $('[data-promo]'),
  ticker: $('[data-ticker]'),
  live: $('[data-live]'),
  themes: $('[data-themes]'),
};

let prefs = load();
let board: BoardView;
let theme = 'all';
let puzzle: Puzzle | null = null;
let chess = new Chess();
let step = 1; // index into puzzle.moves of the learner's next move
let side: Side = 'w';
let failed = false;
let helped = false;
let busy = false;
let hintStep = 0;
let done = false;
let gen = 0;
let kind: '3d' | '2d' = '2d';

const wait = (ms: number) => new Promise((r) => setTimeout(r, motionOn() ? ms : Math.min(ms, 120)));
const fen = () => chess.fen();

function dests(sq: Sq): Sq[] {
  if (!puzzle || busy || done || chess.turn() !== side) return [];
  const p = chess.get(sq as Square);
  if (!p || p.color !== side) return [];
  return chess.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
}

function lastMarks(extra: { arrows?: { from: Sq; to: Sq }[]; focus?: Sq[] } = {}) {
  const h = chess.history({ verbose: true });
  const last = h.length ? ([h[h.length - 1].from, h[h.length - 1].to] as [Sq, Sq]) : null;
  let check: Sq | null = null;
  if (chess.inCheck()) for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === chess.turn()) check = p.square;
  board.setMarks({ last, check, arrows: extra.arrows ?? [], focus: extra.focus ?? [] });
}

function play(uci: string) {
  const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
  board.setPosition(fen(), true);
  lastMarks();
  return m;
}

// ------------------------------------------------------------------ dealing

function pool(): Puzzle[] {
  return theme === 'all' ? ALL : ALL.filter((p) => p.theme === theme || p.themes.includes(theme));
}

function pick(): Puzzle {
  const list = pool();
  const seen = new Set(prefs.seen);
  const fresh = list.filter((p) => !seen.has(p.id));
  const from = fresh.length ? fresh : list;
  // near the learner's rating, a little above it on average
  const target = prefs.puzzleRating + 60;
  const sorted = [...from].sort((a, b) => Math.abs(a.rating - target) - Math.abs(b.rating - target));
  const near = sorted.slice(0, Math.min(6, sorted.length));
  return near[Math.floor(Math.random() * near.length)];
}

async function deal(p: Puzzle = pick()) {
  const g = ++gen;
  puzzle = p;
  chess = new Chess(p.fen);
  step = 1;
  failed = false;
  helped = false;
  done = false;
  hintStep = 0;
  busy = true;
  // the learner plays the side that moves after the opponent's setup move
  side = chess.turn() === 'w' ? 'b' : 'w';
  board.setOrientation(side);
  board.setInteractive(false);
  board.setPosition(p.fen, false);
  board.setMarks({});
  const t = themeOf(p.theme);
  ui.themeName.textContent = t.name;
  ui.puzzleRating.textContent = String(p.rating);
  ui.myRating.textContent = String(prefs.puzzleRating);
  ratingLabel();
  setCoach('intro', side === 'w' ? 'Të bardhat lëvizin' : 'Të zezat lëvizin', t.name, [t.task]);
  showButtons();
  ui.status.textContent = 'Kundërshtari lëviz…';
  ticker();
  await wait(650);
  if (g !== gen) return;
  play(p.moves[0]);
  busy = false;
  board.setInteractive(true);
  ui.status.textContent = 'Radha jote.';
}

// ------------------------------------------------------------------ the learner's move

let promoAsk: ((k: string | null) => void) | null = null;
ui.promo.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('button[data-piece]');
  if (!b || !promoAsk) return;
  ui.promo.hidden = true;
  const r = promoAsk;
  promoAsk = null;
  r(b.dataset.piece === 'x' ? null : b.dataset.piece!);
});

async function onMove(from: Sq, to: Sq) {
  if (!puzzle || busy || done) return;
  const g = gen;
  let promotion: string | undefined;
  const piece = chess.get(from as Square);
  if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
    ui.promo.hidden = false;
    const k = await new Promise<string | null>((r) => (promoAsk = r));
    if (!k) {
      board.setPosition(fen(), true);
      return;
    }
    promotion = k;
  }
  const uci = from + to + (promotion ?? '');
  const expected = puzzle.moves[step];
  // a different mate in a mating puzzle is a solution too
  const test = new Chess(fen());
  let mates = false;
  try {
    test.move({ from, to, promotion });
    mates = test.isCheckmate();
  } catch {
    board.setPosition(fen(), true);
    return;
  }
  const right = uci === expected || (!expected[4] && uci.slice(0, 4) === expected.slice(0, 4) && !promotion) || (mates && step === puzzle.moves.length - 1);
  busy = true;
  board.setInteractive(false);
  if (!right) {
    failed = true;
    const m = play(uci);
    setCoach('wrong', 'Jo kjo', 'Provo përsëri', [`[[${m.san}]] nuk e zgjidh ushtrimin. Shiko çfarë kërcënon kundërshtari dhe kërko diçka më të fortë.`]);
    say('Jo kjo. Provo përsëri.');
    await wait(900);
    if (g !== gen) return;
    chess.undo();
    board.setPosition(fen(), true);
    lastMarks();
    busy = false;
    board.setInteractive(true);
    return;
  }
  const m = play(uci);
  step++;
  if (step >= puzzle.moves.length) return solved(m.san);
  setCoach('good', `${sanHtml(m.san)}`, 'E saktë', ['Vazhdo: kundërshtari përgjigjet.'], true);
  await wait(550);
  if (g !== gen) return;
  play(puzzle.moves[step]);
  step++;
  busy = false;
  board.setInteractive(true);
  ui.status.textContent = 'Radha jote.';
  setCoach('intro', 'Vazhdo', themeOf(puzzle.theme).name, ['Gjej lëvizjen tjetër.']);
}

function solved(lastSan: string) {
  if (!puzzle) return;
  done = true;
  busy = false;
  const clean = !failed && !helped;
  const before = prefs.puzzleRating;
  prefs = update((p) => {
    p.puzzlesTried++;
    if (clean) p.puzzlesSolved++;
    p.puzzleRating = ratePuzzle(p.puzzleRating, puzzle!.rating, clean);
    if (!p.seen.includes(puzzle!.id)) p.seen.push(puzzle!.id);
    p.seen = p.seen.slice(-180);
  });
  const diff = prefs.puzzleRating - before;
  ui.myRating.textContent = String(prefs.puzzleRating);
  ratingLabel();
  const t = themeOf(puzzle.theme);
  setCoach(
    'solved',
    `${sanHtml(lastSan)} Saktë`,
    clean ? `Vlerësimi ${diff >= 0 ? '+' : ''}${diff}` : 'E zgjidhur me ndihmë',
    [t.idea],
    true,
  );
  say(`Saktë. ${t.idea}`);
  ui.status.textContent = 'U zgjidh.';
  showButtons();
  countThemes();
  ticker();
}

// ------------------------------------------------------------------ help

ui.hint.addEventListener('click', () => {
  if (!puzzle || done || busy) return;
  helped = true;
  hintStep = Math.min(2, hintStep + 1);
  const u = puzzle.moves[step];
  if (hintStep === 1) {
    lastMarks({ focus: [u.slice(0, 2)] });
    setCoach('note', 'Ndihmë', 'Lëviz figurën e shënuar', [themeOf(puzzle.theme).idea]);
  } else {
    lastMarks({ focus: [u.slice(0, 2)], arrows: [{ from: u.slice(0, 2), to: u.slice(2, 4) }] });
    setCoach('note', 'Ndihmë', 'Kjo është lëvizja', ['Luaje në tabelë për të vazhduar.']);
  }
});

ui.solution.addEventListener('click', async () => {
  if (!puzzle || done) return;
  const g = gen;
  failed = true;
  busy = true;
  board.setInteractive(false);
  const rest = puzzle.moves.slice(step);
  setCoach('note', 'Zgjidhja', themeOf(puzzle.theme).name, ['Shiko lëvizjet e duhura në tabelë.']);
  let last = '';
  for (let i = 0; i < rest.length; i++) {
    lastMarks({ arrows: [{ from: rest[i].slice(0, 2), to: rest[i].slice(2, 4) }] });
    await wait(700);
    if (g !== gen) return;
    last = play(rest[i]).san;
    await wait(500);
    if (g !== gen) return;
  }
  step = puzzle.moves.length;
  solved(last);
});

ui.next.addEventListener('click', () => void deal());
ui.nextTool.addEventListener('click', () => void deal());
ui.again.addEventListener('click', () => puzzle && void deal(puzzle));

// ------------------------------------------------------------------ the broadcast

function setCoach(state: string, glyph: string, title: string, lines: string[], html = false) {
  ui.coach.dataset.state = state;
  ui.glyph.innerHTML = html ? glyph : glyph.replace(/[<>&]/g, '');
  ui.title.textContent = title;
  ui.reasons.innerHTML = lines.map((l) => `<li>${sentenceHtml(l)}</li>`).join('');
  if (motionOn()) {
    const parts = [ui.coach.querySelector('.lower__tag'), ui.coach.querySelector('.lower__head'), ui.coach.querySelector('.lower__body')];
    gsap.fromTo(parts, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.32, stagger: 0.06, ease: 'power3.out', clearProps: 'clipPath' });
  }
  showButtons();
}

function showButtons() {
  ui.hint.hidden = done;
  ui.solution.hidden = done;
  ui.next.hidden = !done;
  ui.again.hidden = !done || (!failed && !helped);
}

function say(t: string) {
  ui.live.textContent = sentenceText(t);
}

function ratingLabel() {
  document.querySelector('[data-my-label]')!.textContent = prefs.puzzlesTried ? 'Vlerësimi yt' : 'Vlerësimi fillestar';
}

function ticker() {
  const solvedCount = prefs.puzzlesSolved;
  const items = [
    prefs.puzzlesTried ? `Vlerësimi yt: ${prefs.puzzleRating}` : `Vlerësimi fillestar: ${prefs.puzzleRating}. Ndryshon me çdo ushtrim.`,
    `Të zgjidhura pa ndihmë: ${solvedCount}`,
    puzzle ? `Ushtrimi ${puzzle.id} nga Lichess, vlerësimi ${puzzle.rating}` : '',
    ...THEMES.slice(0, 4).map((t) => `${t.name}: ${t.idea}`),
  ].filter(Boolean);
  const html = items.map((t) => `<span>${t.replace(/[<>&]/g, '')}</span>`).join('');
  ui.ticker.innerHTML = html + html;
  ui.ticker.style.setProperty('--crawl', `${Math.max(40, items.join(' ').length * 0.3)}s`);
}

function countThemes() {
  const seen = new Set(prefs.seen);
  const count = (list: Puzzle[]) => `${list.filter((p) => seen.has(p.id)).length} nga ${list.length} të para`;
  ui.themes.querySelector('[data-count="all"]')!.textContent = count(ALL);
  for (const t of THEMES) ui.themes.querySelector(`[data-count="${t.id}"]`)!.textContent = count(ALL.filter((p) => p.theme === t.id || p.themes.includes(t.id)));
}

ui.themes.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name !== 'theme') return;
  theme = input.value;
  void deal();
  document.querySelector('.stage')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
});

// ------------------------------------------------------------------ board and start

async function mount(k: '3d' | '2d') {
  board?.dispose();
  kind = k;
  board = await createBoard(k, { host: ui.host, orientation: side, motion: motionOn, dests, onMove: (f, t) => void onMove(f, t), label: 'Tabela e ushtrimit' });
  board.setPosition(fen(), false);
  lastMarks();
  board.setInteractive(!busy && !done && !!puzzle);
  ui.angle.hidden = board.kind !== '3d';
  ui.view.setAttribute('aria-pressed', board.kind === '3d' ? 'true' : 'false');
  ui.view.querySelector('[data-label]')!.textContent = board.kind === '3d' ? 'Pamje e sheshtë' : 'Pamje 3D';
  ui.view.querySelector('.tool__icon')!.innerHTML = board.kind === '3d' ? icon('square') : icon('cube');
}

ui.view.addEventListener('click', () => void mount(kind === '3d' ? '2d' : '3d'));
ui.angle.addEventListener('click', () => {
  const n = board.cycleAngle?.();
  if (n) say(n);
});

onMotion((on) => board?.setMotion(on));
onTick((dt) => board?.tick(dt));
followBroadcast(ui.host, ui.coach, () => board);
keyboard(ui.host, () => board, () => side);

(async () => {
  await mount('2d');
  countThemes();
  ui.myRating.textContent = String(prefs.puzzleRating);
  await deal();
})();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__puzzle = {
    state: () => ({ id: puzzle?.id, step, side, done, failed, fen: fen(), next: puzzle?.moves[step] }),
    move: (f: Sq, t: Sq) => onMove(f, t),
  };
}
