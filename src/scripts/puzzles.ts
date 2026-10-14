// Puzzles: a real position from the Lichess database, the opponent's last move played in front of the learner,
// then their turn. A wrong move is shown and taken back; a solved puzzle moves the puzzle rating.

import { Chess, type Square } from 'chess.js';
import puzzles from '../data/puzzles.json';
import { sanHtml, sentenceHtml, sentenceText } from '../lib/notation.ts';
import { DAYS, dueCards, load, ratePuzzle, reviewCard, solveDaily, streakNow, today, update, type Card } from '../lib/store.ts';
import { THEMES, themeOf } from '../lib/themes.ts';
import { createBoard, keepBoardStill, keyboard, type BoardView } from './board/index.ts';
import type { Side, Sq } from './board/types.ts';
import { gsap, motionOn, onMotion, onTick } from './shell.ts';
import { missSound, moveSound, winSound } from '../lib/sound.ts';
import { remindDone } from '../lib/remind.ts';

interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  theme: string;
  themes: string[];
  /** one of the learner's own mistakes: no setup move, any of these first moves solves it */
  card?: Card;
}

const fromCard = (c: Card): Puzzle => ({ id: c.id, fen: c.fen, moves: [c.good[0]], rating: 0, theme: 'mine', themes: [], card: c });
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
/** a theme from the list, today's puzzle, or the three-minute race */
let mode: 'theme' | 'daily' | 'rush' = 'theme';
const RUSH_SECONDS = 180;
const rush = { active: false, left: RUSH_SECONDS, score: 0, strikes: 0, target: 600, used: new Set<string>() };

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
  moveSound(m.san);
  board.setPosition(fen(), true);
  lastMarks();
  return m;
}

// ------------------------------------------------------------------ dealing

function pool(): Puzzle[] {
  return theme === 'all' ? ALL : ALL.filter((p) => p.theme === theme || p.themes.includes(theme));
}

/** Today's puzzle: near the learner's rating, chosen by the date, so it stays the same all day. */
function dailyPuzzle(): Puzzle {
  const t = today();
  if (prefs.daily?.date === t) {
    const kept = ALL.find((p) => p.id === prefs.daily!.id);
    if (kept) return kept;
  }
  const near = [...ALL].sort((a, b) => Math.abs(a.rating - prefs.puzzleRating) - Math.abs(b.rating - prefs.puzzleRating)).slice(0, 60);
  let h = 0;
  for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const p = near[h % near.length];
  prefs = update((x) => (x.daily = { date: t, id: p.id, solved: false }));
  return p;
}

/** The race: each puzzle a little harder than the last, never the same one twice in a race. */
function rushPuzzle(): Puzzle {
  const fresh = ALL.filter((p) => !rush.used.has(p.id) && p.rating >= rush.target - 120);
  const from = fresh.length ? fresh : ALL.filter((p) => !rush.used.has(p.id));
  const near = [...from].sort((a, b) => Math.abs(a.rating - rush.target) - Math.abs(b.rating - rush.target)).slice(0, 5);
  const p = near[Math.floor(Math.random() * near.length)];
  rush.used.add(p.id);
  return p;
}

function pick(): Puzzle | null {
  if (mode === 'daily') return dailyPuzzle();
  if (mode === 'rush') return rushPuzzle();
  if (theme === 'mine') {
    const due = dueCards(prefs);
    return due.length ? fromCard(due[0]) : null;
  }
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

async function deal(next?: Puzzle | null) {
  if (mode === 'daily' && prefs.daily?.date === today() && prefs.daily.solved) return dailyDone();
  if (next === undefined) next = pick();
  const g = ++gen;
  if (!next) return noneDue();
  const p = next;
  puzzle = p;
  chess = new Chess(p.fen);
  const own = !!p.card;
  step = own ? 0 : 1;
  failed = false;
  helped = false;
  done = false;
  hintStep = 0;
  busy = !own;
  // a Lichess puzzle: the learner plays the side that moves after the setup move; an own mistake: the side to move
  side = own ? (chess.turn() as Side) : chess.turn() === 'w' ? 'b' : 'w';
  board.setOrientation(side);
  board.setInteractive(false);
  board.setPosition(p.fen, false);
  board.setMarks({});
  if (own) {
    const c = p.card!;
    ui.themeName.textContent = 'Gabimi yt';
    ui.puzzleRating.textContent = c.made.split('-').reverse().slice(0, 2).join('.');
    setCoach('intro', 'Gjej më të mirën', side === 'w' ? 'Të bardhat lëvizin' : 'Të zezat lëvizin', ['Në një lojë tënde këtu luajte një lëvizje të gabuar. Gjej një më të mirë.']);
  } else {
    const t = themeOf(p.theme);
    ui.themeName.textContent = t.name;
    ui.puzzleRating.textContent = String(p.rating);
    setCoach('intro', side === 'w' ? 'Të bardhat lëvizin' : 'Të zezat lëvizin', t.name, [t.task]);
  }
  ui.myRating.textContent = String(prefs.puzzleRating);
  ratingLabel();
  capsule();
  showButtons();
  ui.status.textContent = own ? 'Radha jote.' : 'Kundërshtari lëviz…';
  ticker();
  if (!own) {
    await wait(650);
    if (g !== gen) return;
    play(p.moves[0]);
    busy = false;
  }
  board.setInteractive(true);
  ui.status.textContent = 'Radha jote.';
}

function noneDue() {
  puzzle = null;
  done = true;
  board.setInteractive(false);
  board.setMarks({});
  const left = prefs.cards.filter((c) => c.box <= 4);
  const next = left.map((c) => c.due).sort()[0];
  setCoach(
    'note',
    'Asnjë për sot',
    'Gabimet e tua',
    [
      left.length
        ? `Ke ${left.length} gabime në radhë; i radhës kthehet më ${next.split('-').reverse().join('.')}. Zgjidh një temë tjetër ose luaj një lojë.`
        : 'Kur bën një gabim në lojë, trajneri e ruan këtu si ushtrim dhe ta kthen derisa ta zgjidhësh pa gabuar.',
    ],
  );
  ui.status.textContent = 'Asgjë për sot.';
  ui.hint.hidden = true;
  ui.solution.hidden = true;
  ui.next.hidden = true;
  ui.again.hidden = true;
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
  const same = (a: string) => a === uci || (!a[4] && uci.slice(0, 4) === a.slice(0, 4) && !promotion);
  const right = same(expected) || (step === 0 && !!puzzle.card?.good.some(same)) || (mates && step === puzzle.moves.length - 1);
  busy = true;
  board.setInteractive(false);
  if (!right) {
    failed = true;
    const m = play(uci);
    missSound();
    if (mode === 'rush') return rushMiss(m.san, g);
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
  if (mode === 'rush') return rushSolved(lastSan);
  done = true;
  busy = false;
  const clean = !failed && !helped;
  if (puzzle.card) return solvedCard(puzzle.card, lastSan, clean);
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
  winSound();
  if (mode === 'daily') {
    prefs = solveDaily(puzzle.id);
    void remindDone();
  }
  const streak = streakNow(prefs);
  setCoach(
    'solved',
    `${sanHtml(lastSan)} Saktë`,
    mode === 'daily' ? `Ushtrimi i ditës · ${streak} ${streak === 1 ? 'ditë' : 'ditë rresht'}` : clean ? `Vlerësimi ${diff >= 0 ? '+' : ''}${diff}` : 'E zgjidhur me ndihmë',
    [t.idea],
    true,
  );
  say(`Saktë. ${t.idea}`);
  ui.status.textContent = 'U zgjidh.';
  capsule();
  showButtons();
  countThemes();
  ticker();
}

/** An own mistake solved: the card moves on its schedule; the puzzle rating is not touched. */
function solvedCard(c: Card, san: string, clean: boolean) {
  const after = reviewCard(c.id, clean);
  prefs = load();
  const when = !after ? '' : after.box > 4 ? 'E mësuar: nuk kthehet më.' : clean ? (DAYS[after.box] === 1 ? 'Kthehet nesër.' : `Kthehet pas ${DAYS[after.box]} ditësh.`) : 'Kthehet nesër.';
  winSound();
  setCoach('solved', `${sanHtml(san)} Saktë`, when, [`Në lojë luajte [[${c.played}]]. ${c.reason}`], true);
  say(`Saktë. ${when}`);
  ui.status.textContent = 'U zgjidh.';
  showButtons();
  countThemes();
  ticker();
}

// ------------------------------------------------------------------ today's puzzle and the race

const clockText = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

/** The top capsule speaks for the mode: the race shows its clock and score, today's puzzle the streak. */
function capsule() {
  const label = document.querySelector('[data-my-label]')!;
  if (mode === 'rush') {
    ui.themeName.textContent = 'Gara';
    ui.puzzleRating.textContent = clockText(rush.left);
    label.textContent = 'Pikët';
    ui.myRating.textContent = rush.strikes ? `${rush.score} · ${rush.strikes} ${rush.strikes === 1 ? 'gabim' : 'gabime'}` : String(rush.score);
  } else if (mode === 'daily') {
    ui.themeName.textContent = 'Ushtrimi i ditës';
    label.textContent = 'Ditë rresht';
    ui.myRating.textContent = String(streakNow(prefs));
  }
}

function dailyDone() {
  puzzle = null;
  done = true;
  board.setInteractive(false);
  board.setMarks({});
  const n = streakNow(prefs);
  setCoach('note', 'U zgjidh sot', n === 1 ? '1 ditë' : `${n} ditë rresht`, ['Ushtrimi i ditës kthehet nesër. Ndërkohë zgjidh një temë ose provo garën 3 minutëshe.']);
  ui.status.textContent = 'Kthehu nesër.';
  capsule();
  ui.hint.hidden = true;
  ui.solution.hidden = true;
  ui.again.hidden = true;
  ui.next.hidden = false;
}

function startRush() {
  mode = 'rush';
  Object.assign(rush, { active: true, left: RUSH_SECONDS, score: 0, strikes: 0, target: Math.max(500, Math.min(1200, prefs.puzzleRating - 300)), used: new Set<string>() });
  say('Gara filloi: tre minuta.');
  void deal();
}

function stopRush() {
  rush.active = false;
}

/** A solved race puzzle: a point, a step harder, and straight on to the next. */
async function rushSolved(san: string) {
  const g = gen;
  rush.score++;
  rush.target += 60;
  winSound();
  setCoach('good', `${sanHtml(san)} Saktë`, `${rush.score} pikë`, ['Tjetri vjen menjëherë.'], true);
  capsule();
  await wait(450);
  if (g !== gen || !rush.active) return;
  void deal();
}

/** A wrong move in the race: a strike; the third ends it. */
async function rushMiss(san: string, g: number) {
  rush.strikes++;
  capsule();
  setCoach('wrong', 'Jo kjo', `${rush.strikes} nga 3 gabime`, [`[[${san}]] nuk e zgjidh ushtrimin.`]);
  await wait(800);
  if (g !== gen) return;
  if (rush.strikes >= 3) return endRush('Tre gabime.');
  void deal();
}

function endRush(why: string) {
  if (!rush.active) return;
  rush.active = false;
  gen++;
  done = true;
  busy = false;
  board.setInteractive(false);
  const best = prefs.rushBest;
  const record = rush.score > best;
  if (record) prefs = update((p) => (p.rushBest = rush.score));
  if (rush.score) winSound();
  setCoach(
    'end',
    `${rush.score} ${rush.score === 1 ? 'pikë' : 'pikë'}`,
    record ? 'Rekord i ri' : `Rekordi yt: ${best}`,
    [`${why} Zgjidhe ${rush.score} ${rush.score === 1 ? 'ushtrim' : 'ushtrime'} në garë.`, 'Provo përsëri për të thyer rekordin, ose kthehu te temat.'],
  );
  ui.status.textContent = 'Gara mbaroi.';
  capsule();
  showButtons();
  renderModes();
}

// the race clock runs on the one ticker
onTick((dt) => {
  if (!rush.active) return;
  const before = Math.ceil(rush.left);
  rush.left -= dt;
  if (Math.ceil(rush.left) !== before) ui.puzzleRating.textContent = clockText(rush.left);
  if (rush.left <= 0) endRush('Koha mbaroi.');
});

/** The two modes above the themes, with today's state and the race record. */
function renderModes() {
  const d = prefs.daily?.date === today() && prefs.daily.solved;
  const n = streakNow(prefs);
  const line = document.querySelector('[data-daily-line]');
  if (line) line.textContent = d ? `U zgjidh sot · ${n === 1 ? '1 ditë' : `${n} ditë rresht`}` : n ? `${n} ditë rresht. Mos e humb serinë.` : 'Një ushtrim i ri çdo ditë.';
  const best = document.querySelector('[data-rush-best]');
  if (best) best.textContent = prefs.rushBest ? `Rekordi yt: ${prefs.rushBest} pikë` : 'Sa ushtrime zgjidh në 3 minuta?';
}

document.querySelector('[data-daily]')?.addEventListener('click', () => {
  stopRush();
  mode = 'daily';
  void deal();
  document.querySelector('.stage')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
});
document.querySelector('[data-rush]')?.addEventListener('click', () => {
  startRush();
  document.querySelector('.stage')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
});

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

// Next leaves today's puzzle or the race for the chosen theme; Again restarts a race that ended
const toThemes = () => {
  if (mode !== 'theme') {
    stopRush();
    mode = 'theme';
  }
  void deal();
};
ui.next.addEventListener('click', toThemes);
ui.nextTool.addEventListener('click', toThemes);
ui.again.addEventListener('click', () => {
  if (mode === 'rush') return startRush();
  if (puzzle) void deal(puzzle);
});

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
  if (mode === 'rush') {
    // no help in a race: solve it or lose a strike
    ui.hint.hidden = true;
    ui.solution.hidden = true;
    ui.next.hidden = !done;
    ui.again.hidden = !done;
    return;
  }
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
    puzzle && !puzzle.card ? `Ushtrimi ${puzzle.id} nga Lichess, vlerësimi ${puzzle.rating}` : puzzle?.card ? `Gabim nga loja jote e ${puzzle.card.made.split("-").reverse().join(".")}` : '',
    ...THEMES.slice(0, 4).map((t) => `${t.name}: ${t.idea}`),
  ].filter(Boolean);
  const html = items.map((t) => `<span>${t.replace(/[<>&]/g, '')}</span>`).join('');
  ui.ticker.innerHTML = html + html;
  ui.ticker.style.setProperty('--crawl', `${Math.max(40, items.join(' ').length * 0.3)}s`);
}

function countThemes() {
  const mine = ui.themes.querySelector('[data-count="mine"]');
  if (mine) {
    const due = dueCards(prefs).length;
    const all = prefs.cards.filter((c) => c.box <= 4).length;
    mine.textContent = all ? `${due} për sot, ${all} në radhë` : 'Bosh: mbushet kur gabon në lojë';
  }
  const seen = new Set(prefs.seen);
  const count = (list: Puzzle[]) => `${list.filter((p) => seen.has(p.id)).length} nga ${list.length} të para`;
  ui.themes.querySelector('[data-count="all"]')!.textContent = count(ALL);
  for (const t of THEMES) ui.themes.querySelector(`[data-count="${t.id}"]`)!.textContent = count(ALL.filter((p) => p.theme === t.id || p.themes.includes(t.id)));
}

ui.themes.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  if (input.name !== 'theme') return;
  theme = input.value;
  stopRush();
  mode = 'theme';
  void deal();
  document.querySelector('.stage')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
});

// ------------------------------------------------------------------ board and start

/** The board is always the 3D table (the flat one comes only where WebGL fails). */
async function mount() {
  board?.dispose();
  board = await createBoard('3d', { host: ui.host, orientation: side, motion: motionOn, dests, onMove: (f, t) => void onMove(f, t), label: 'Tabela e ushtrimit', keepTaken: false });
  board.setPosition(fen(), false);
  lastMarks();
  board.setInteractive(!busy && !done && !!puzzle);
  ui.angle.hidden = board.kind !== '3d';
}

ui.angle.addEventListener('click', () => {
  const n = board.cycleAngle?.();
  if (n) say(n);
});

onMotion((on) => board?.setMotion(on));
onTick((dt) => board?.tick(dt));
keepBoardStill(ui.host, ui.coach, () => board);
keyboard(ui.host, () => board, () => side);

(async () => {
  // /ushtrime/?tema=gabimet opens on the learner's own mistakes, ?tema=dita on today's puzzle, ?tema=gara on the race
  const tema = new URLSearchParams(location.search).get('tema');
  if (tema === 'gabimet') {
    theme = 'mine';
    ui.themes.querySelector<HTMLInputElement>('input[value="mine"]')!.checked = true;
  }
  if (tema === 'dita') mode = 'daily';
  await mount();
  countThemes();
  renderModes();
  ui.myRating.textContent = String(prefs.puzzleRating);
  if (tema === 'gara') return startRush();
  await deal();
})();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__puzzle = {
    state: () => ({ id: puzzle?.id, step, side, done, failed, fen: fen(), next: puzzle?.moves[step], mode, rush: { ...rush, used: rush.used.size } }),
    endRush: () => endRush('Koha mbaroi.'),
    move: (f: Sq, t: Sq) => onMove(f, t),
  };
}
