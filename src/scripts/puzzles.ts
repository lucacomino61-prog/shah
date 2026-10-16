// Puzzles: a real position from the Lichess database, the opponent's last move played in front of the learner,
// then their turn. A wrong move is shown and taken back; a solved puzzle moves the puzzle rating.

import { Chess, type Square } from 'chess.js';
import puzzles from '../data/puzzles.json';
import { sanHtml, sentenceHtml, sentenceText } from '../lib/notation.ts';
import { DAYS, dueCards, load, ratePuzzle, reviewCard, solveDaily, streakNow, today, update, type Card } from '../lib/store.ts';
import { THEMES, themeOf } from '../lib/themes.ts';
import { createBoard, keepBoardStill, keyboard, mateFall, type BoardView } from './board/index.ts';
import type { Side, Sq } from './board/types.ts';
import { gsap, motionOn, onMotion, onTick } from './shell.ts';
import { missSound, moveSound, winSound } from '../lib/sound.ts';
import { remindDone } from '../lib/remind.ts';
import { rollStreak } from './celebrate.ts';
import { closePanels, openPanel } from './panel.ts';
import { pickDaily } from '../lib/daily.ts';
import { shareCard } from './share.ts';
import { api, hasServer, ServerError } from '../lib/server.ts';
import { speakSq } from '../lib/voice.ts';

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
  share: $<HTMLButtonElement>('[data-share]'),
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
/** a theme from the list, today's puzzle, the three-minute race, or a challenge between friends */
let mode: 'theme' | 'daily' | 'rush' | 'contest' = 'theme';
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
  const p = pickDaily(ALL, prefs.puzzleRating, t);
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
  if (mode === 'contest') {
    // the challenge's puzzles in their order (one this app does not have is passed over)
    while (contest.i < contest.ids.length) {
      const p = ALL.find((x) => x.id === contest.ids[contest.i]);
      if (p) return p;
      contest.i++;
    }
    return null;
  }
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
    ui.puzzleRating.textContent = '';
    const when = c.made.split('-').reverse().slice(0, 2).join('.');
    setCoach('intro', 'Gjej më të mirën', side === 'w' ? 'Të bardhat lëvizin' : 'Të zezat lëvizin', [`Në lojën tënde të ${when} këtu luajte një lëvizje të gabuar. Gjej një më të mirë.`]);
  } else {
    const t = themeOf(p.theme);
    ui.themeName.textContent = t.name;
    ui.puzzleRating.textContent = '';
    // the puzzle's difficulty, named, where there is room for the word; the first puzzle ever also says what the
    // learner's own number is and how it moves
    const lines = [t.task];
    if (!prefs.puzzlesTried) lines.push(`Vlerësimi yt fillon nga ${prefs.puzzleRating}: rritet kur e zgjidh pa ndihmë, ulet kur jo.`);
    setCoach('intro', side === 'w' ? 'Të bardhat lëvizin' : 'Të zezat lëvizin', `${t.name} · vështirësia ${p.rating}`, lines);
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
    if (mode === 'contest') return contestMiss(m.san, g);
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
  if (chess.isCheckmate()) mateFall(() => board, chess.fen(), () => chess.fen());
  if (mode === 'rush') return rushSolved(lastSan);
  if (mode === 'contest') return contestSolved(lastSan);
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
  const hadDays = streakNow(prefs);
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
  // a day more on the streak: the count rolls up and the flame jumps
  if (mode === 'daily') rollStreak(ui.myRating, hadDays, streak, document.querySelector('[data-flame] .icon'));
  showButtons();
  ui.share.hidden = mode !== 'daily';
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
  } else if (mode === 'contest') {
    ui.themeName.textContent = 'Sfida';
    ui.puzzleRating.textContent = `${Math.min(contest.i + 1, contest.ids.length)}/${contest.ids.length}`;
    label.textContent = 'Pikët';
    ui.myRating.textContent = String(contest.score);
  } else if (mode === 'daily') {
    ui.themeName.textContent = 'Ushtrimi i ditës';
    label.textContent = 'Ditë rresht';
    ui.myRating.textContent = String(streakNow(prefs));
  }
  document.querySelector<HTMLElement>('[data-flame]')!.hidden = mode !== 'daily';
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
  ui.share.hidden = false;
}

// today's puzzle, solved, as a picture for friends: its position and the streak
ui.share.addEventListener('click', async () => {
  const p = ALL.find((x) => x.id === prefs.daily?.id);
  if (!p) return;
  const c = new Chess(p.fen);
  const m = c.move({ from: p.moves[0].slice(0, 2), to: p.moves[0].slice(2, 4), promotion: p.moves[0][4] || undefined });
  const n = streakNow(prefs);
  ui.share.disabled = true;
  try {
    const how = await shareCard(
      { kicker: 'Ushtrimi i ditës', title: 'E zgjidha sot', line: n > 1 ? `${n} ditë rresht · ${themeOf(p.theme).name}` : themeOf(p.theme).name, fen: c.fen(), side: c.turn(), marks: [m.from, m.to] },
      'Zgjidha ushtrimin e ditës në Shah. Provoje edhe ti:',
    );
    if (how === 'saved') say('Fotografia u ruajt.');
  } finally {
    ui.share.disabled = false;
  }
});

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
  closePanels();
});
document.querySelector('[data-rush]')?.addEventListener('click', () => {
  startRush();
  closePanels();
});

// ------------------------------------------------------------------ a challenge between friends ("Sfida")
// Ten puzzles fixed by whoever makes it, the same for everyone with the link; no help, a wrong move passes the
// puzzle; the result (solved, then time) goes to the server's board. Hidden where there is no server.

interface ContestInfo {
  code: string;
  puzzles: string[];
  by: string;
  at: number;
  ends: number;
  board: { name: string; score: number; ms: number; at: number }[];
}
const contest = { code: '', ids: [] as string[], i: 0, score: 0, start: 0, by: '', info: null as ContestInfo | null, mine: -1 };
const cs = {
  lede: $('[data-contest-lede]'),
  name: $<HTMLInputElement>('[data-contest-name]'),
  err: $('[data-contest-err]'),
  go: $<HTMLButtonElement>('[data-contest-go]'),
  invite: $<HTMLButtonElement>('[data-contest-invite]'),
  boardH: $('[data-contest-board-h]'),
  board: $('[data-contest-board]'),
  ends: $('[data-contest-ends]'),
};
const store = (k: string, v?: string) => {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    /* forgotten on reload */
  }
  return null;
};
/** the phone's own token: one entry per player on each board */
function token(): string {
  let t = store('shah.contest.token');
  if (!t || !/^[0-9a-f]{32}$/.test(t)) {
    t = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    store('shah.contest.token', t);
  }
  return t;
}
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const contestLink = () => `${location.origin}/ushtrime/?sfida=${contest.code}`;
const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function contestError(e: unknown) {
  const st = e instanceof ServerError ? e.status : 0;
  const what = e instanceof ServerError ? String(e.data?.error ?? '') : '';
  cs.err.textContent =
    st === 404 ? 'Kjo sfidë nuk ekziston më (zgjat dy javë).' : what === 'full' ? 'Sfida është plot: 50 lojtarë.' : what === 'name' ? 'Shkruaj një emër, deri në 20 shkronja.' : 'Sfida nuk u hap. Kontrollo internetin dhe provo përsëri.';
  cs.err.hidden = false;
}

function drawBoard() {
  const info = contest.info;
  const rows = info?.board ?? [];
  cs.boardH.hidden = cs.board.hidden = !info;
  cs.board.innerHTML = rows.length
    ? rows
        .map((e, k) => `<li${k === contest.mine ? ' data-me' : ''}><span class="rank">${k + 1}</span><span class="who">${escHtml(e.name)}</span><span class="res"><b>${e.score}/${info!.puzzles.length}</b> · ${clock(e.ms)}</span></li>`)
        .join('')
    : '<li><span class="rank">·</span><span class="who">Ende askush në tabelë.</span><span></span></li>';
  if (info) {
    const days = Math.max(0, Math.ceil((info.ends - Date.now()) / 86400000));
    cs.ends.textContent = `Sfida mbetet e hapur edhe ${days === 1 ? '1 ditë' : `${days} ditë`}. Kodi: ${info.code}.`;
  }
  cs.ends.hidden = !info;
}

/** the sheet in one of its states: making one, one opened from a link, or a result */
function contestSheet(state: 'create' | 'join' | 'result') {
  cs.err.hidden = true;
  cs.name.value = cs.name.value || store('shah.name') || '';
  if (state === 'create') {
    contest.info = null;
    contest.mine = -1;
    cs.lede.textContent = 'Dhjetë ushtrime rreth nivelit tënd. Shokët që hapin lidhjen zgjidhin të njëjtat, dhe tabela tregon kush zgjidhi më shumë e më shpejt. Pa ndihmë: një gabim e kalon ushtrimin.';
    cs.go.textContent = 'Krijo sfidën';
    cs.invite.hidden = true;
  } else if (state === 'join') {
    const n = contest.ids.length;
    cs.lede.textContent = `Sfida nga ${contest.by}: ${n} ushtrime, të njëjtat për të gjithë. Pa ndihmë: një gabim e kalon ushtrimin.`;
    cs.go.textContent = 'Fillo';
    cs.invite.hidden = false;
  } else {
    const me = contest.info?.board[contest.mine];
    cs.lede.textContent = me
      ? `Zgjidhe ${me.score} nga ${contest.ids.length}, në ${clock(me.ms)}. Vendi yt: ${contest.mine + 1} nga ${contest.info!.board.length}.`
      : 'Rezultati nuk u ruajt.';
    cs.go.textContent = 'Provo përsëri';
    cs.invite.hidden = false;
  }
  cs.go.dataset.state = state;
  drawBoard();
  openPanel('contest');
}

function nameOk(): string | null {
  const v = cs.name.value.replace(/\s+/g, ' ').trim();
  if (!v || [...v].length > 20) {
    cs.err.textContent = 'Shkruaj një emër, deri në 20 shkronja.';
    cs.err.hidden = false;
    cs.name.focus();
    return null;
  }
  store('shah.name', v);
  return v;
}

/** ten puzzles near the learner's rating, not seen before where it can, from as many themes as it can, easy first */
function contestPuzzles(): string[] {
  const seen = new Set(prefs.seen);
  const near = (d: number) => ALL.filter((p) => Math.abs(p.rating - prefs.puzzleRating) <= d && !seen.has(p.id));
  const pool = near(150).length >= 30 ? near(150) : near(400).length >= 30 ? near(400) : ALL;
  const out: Puzzle[] = [];
  const themesUsed = new Map<string, number>();
  for (const p of [...pool].sort(() => Math.random() - 0.5)) {
    if ((themesUsed.get(p.theme) ?? 0) >= 2) continue;
    out.push(p);
    themesUsed.set(p.theme, (themesUsed.get(p.theme) ?? 0) + 1);
    if (out.length === 10) break;
  }
  return out.sort((a, b) => a.rating - b.rating).map((p) => p.id);
}

async function contestGo() {
  const state = cs.go.dataset.state;
  const name = nameOk();
  if (!name) return;
  cs.err.hidden = true;
  if (state === 'create') {
    cs.go.disabled = true;
    try {
      const info = await api<ContestInfo>('/contest', { body: { puzzles: contestPuzzles(), name } });
      Object.assign(contest, { code: info.code, ids: info.puzzles, by: info.by, info });
      history.replaceState(null, '', `/ushtrime/?sfida=${info.code}`);
      contestSheet('join');
      cs.lede.textContent = 'Sfida u krijua. Fto shokët me lidhjen, pastaj fillo vetë.';
    } catch (e) {
      contestError(e);
    } finally {
      cs.go.disabled = false;
    }
    return;
  }
  // play it (again): from the first puzzle, the clock from now
  stopRush();
  Object.assign(contest, { i: 0, score: 0, start: Date.now() });
  mode = 'contest';
  closePanels();
  say(`Sfida filloi: ${contest.ids.length} ushtrime.`);
  void deal();
}

async function contestSolved(san: string) {
  const g = gen;
  contest.score++;
  winSound();
  setCoach('good', `${sanHtml(san)} Saktë`, `${contest.score} pikë`, ['Tjetri vjen menjëherë.'], true);
  capsule();
  await wait(500);
  if (g !== gen || mode !== 'contest') return;
  contestNext();
}

async function contestMiss(san: string, g: number) {
  capsule();
  setCoach('wrong', 'Jo kjo', 'Ky ushtrim kaloi', [`[[${san}]] nuk e zgjidh ushtrimin. Në sfidë nuk ka provë të dytë.`]);
  await wait(900);
  if (g !== gen || mode !== 'contest') return;
  contestNext();
}

function contestNext() {
  contest.i++;
  if (contest.i >= contest.ids.length) return void contestEnd();
  void deal();
}

async function contestEnd() {
  gen++;
  done = true;
  busy = false;
  board.setInteractive(false);
  const ms = Math.max(1000, Date.now() - contest.start);
  const n = contest.ids.length;
  setCoach('end', `${contest.score} nga ${n}`, `Koha: ${clock(ms)}`, ['Po dërgohet rezultati…']);
  mode = 'theme';
  try {
    const info = await api<ContestInfo>(`/contest/${contest.code}/score`, { body: { token: token(), name: store('shah.name') ?? '', score: contest.score, ms } });
    contest.info = info;
    // which row is this phone's: the newest entry with this name, score and time
    contest.mine = info.board.findIndex((e) => e.name === store('shah.name') && e.score === contest.score && e.ms === ms);
    if (contest.mine < 0) contest.mine = info.board.findIndex((e) => e.name === store('shah.name'));
    setCoach('end', `${contest.score} nga ${n}`, `Koha: ${clock(ms)}`, [`Vendi yt: ${contest.mine + 1} nga ${info.board.length}.`]);
    contestSheet('result');
  } catch (e) {
    setCoach('end', `${contest.score} nga ${n}`, `Koha: ${clock(ms)}`, ['Rezultati nuk u dërgua. Kontrollo internetin.']);
    contestError(e);
  }
  ui.next.hidden = false;
}

async function contestOpen(code: string) {
  try {
    const info = await api<ContestInfo>(`/contest/${code}`);
    Object.assign(contest, { code: info.code, ids: info.puzzles, by: info.by, info, mine: -1 });
    contestSheet('join');
  } catch (e) {
    contest.info = null;
    contestSheet('create');
    contestError(e);
  }
}

cs.go.addEventListener('click', () => void contestGo());
cs.name.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void contestGo();
});
cs.invite.addEventListener('click', async () => {
  const text = `Sfidë shahu: ${contest.ids.length} ushtrime, të njëjtat për të gjithë. Sa zgjidh ti?`;
  try {
    if (navigator.share) await navigator.share({ title: 'Shah: sfidë', text, url: contestLink() });
    else {
      await navigator.clipboard.writeText(`${text} ${contestLink()}`);
      cs.err.textContent = 'Lidhja u kopjua.';
      cs.err.hidden = false;
    }
  } catch {
    /* the share sheet was closed */
  }
});
const contestNew = document.querySelector<HTMLButtonElement>('[data-contest-new]');
if (contestNew && hasServer) {
  contestNew.hidden = false;
  contestNew.addEventListener('click', () => {
    closePanels();
    contestSheet('create');
  });
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
  ui.share.hidden = true;
  if (mode === 'rush' || mode === 'contest') {
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
  speakSq(t);
}

/** The learner's rating in the capsule: "Ti" on a phone, where the theme needs the room, the words on a wide screen
 *  (and for a screen reader everywhere). */
function ratingLabel() {
  const long = prefs.puzzlesTried ? 'Vlerësimi yt' : 'Vlerësimi fillestar';
  document.querySelector('[data-my-label]')!.innerHTML = `<span class="me-short" aria-hidden="true">Ti</span><span class="me-long">${long}</span>`;
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
  closePanels();
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
  // a challenge link: its sheet over the first puzzle of the day's list
  const sfida = new URLSearchParams(location.search).get('sfida');
  if (sfida && hasServer && /^[A-Za-z0-9]{4}$/.test(sfida)) void contestOpen(sfida.toUpperCase());
  await deal();
})();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__puzzle = {
    state: () => ({ id: puzzle?.id, step, side, done, failed, fen: fen(), next: puzzle?.moves[step], mode, rush: { ...rush, used: rush.used.size } }),
    endRush: () => endRush('Koha mbaroi.'),
    move: (f: Sq, t: Sq) => onMove(f, t),
  };
}
