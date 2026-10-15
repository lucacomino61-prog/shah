// The game against the engine, with the commentator. One move at a time: the learner moves, the coach grades it
// from two searches (before and after), the engine answers at the chosen level, and the coach looks at what the
// engine now threatens. "Shiko pse" leaves the game and plays the line on the board, then the pieces fly back.

import { Chess, type Square } from 'chess.js';
import { GRADES, TAG_NAMES, afterReply, gameAccuracy, judge, lineScore, passTurn, threatWarning, uciSan, winChance, type Grade, type Verdict } from '../lib/coach.ts';
import { Engine, type Analysis } from '../lib/engine.ts';
import { LEVELS, hopeless, levelOf, pickMove, thinkTime, type Level } from '../lib/levels.ts';
import { sanHtml, sentenceHtml, sentenceText } from '../lib/notation.ts';
import { openingOf } from '../lib/openings.ts';
import { addCard, load, loadGame, saveGame, update, type Progress } from '../lib/store.ts';
import { inDanger } from '../lib/threats.ts';
import { moveSound, winSound } from '../lib/sound.ts';
import { createBoard, keepBoardStill, keyboard, mateFall, type BoardView } from './board/index.ts';
import type { Arrow, Side, Sq } from './board/types.ts';
import { gsap, motionOn, onMotion, onTick } from './shell.ts';
import { takenIcons, writeTaken } from './celebrate.ts';
import { portrait } from '../lib/bots.ts';
import { scoreVs, scoreWords } from '../lib/record.ts';
import { fly, resetChatter, seat as seatOpponent, speak } from './seat.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const START = new Chess().fen();

/** the move the strip holds in view while a past move is open on the board; null follows the game */
let stripPly: number | null = null;

const ui = {
  host: $('[data-board]'),
  them: $('[data-them]'),
  you: $('[data-you]'),
  rail: $('[data-rail]'),
  strip: $('[data-strip]'),
  status: $('[data-status]'),
  opening: $('[data-opening]'),
  coach: $('[data-coach]'),
  glyph: $('[data-glyph]'),
  title: $('[data-title]'),
  reasons: $('[data-reasons]'),
  warning: $('[data-warning]'),
  actions: $('[data-actions]'),
  why: $<HTMLButtonElement>('[data-why]'),
  retry: $<HTMLButtonElement>('[data-retry]'),
  hint: $<HTMLButtonElement>('[data-hint]'),
  study: $('[data-study]'),
  studyWhy: $<HTMLButtonElement>('[data-study-why]'),
  studyBest: $<HTMLButtonElement>('[data-study-best]'),
  prev: $<HTMLButtonElement>('[data-prev]'),
  next: $<HTMLButtonElement>('[data-next]'),
  back: $<HTMLButtonElement>('[data-back]'),
  sheet: $('[data-sheet]'),
  setup: $<HTMLFormElement>('[data-setup]'),
  review: $<HTMLDetailsElement>('[data-review-box]'),
  reviewSvg: $<SVGSVGElement>('[data-review-svg]'),
  reviewCap: $('[data-review-cap]'),
  turning: $<HTMLButtonElement>('[data-turning]'),
  setupDialog: $<HTMLDialogElement>('[data-setup-dialog]'),
  tag: $('[data-tag]'),
  liveTag: $('[data-live-tag]'),
  ticker: $('[data-ticker]'),
  setupOpen: $<HTMLButtonElement>('[data-new]'),
  setupClose: $<HTMLButtonElement>('[data-setup-close]'),
  undo: $<HTMLButtonElement>('[data-undo]'),
  flip: $<HTMLButtonElement>('[data-flip]'),
  resign: $<HTMLButtonElement>('[data-resign]'),
  promo: $('[data-promo]'),
  end: $('[data-end]'),
  live: $('[data-live]'),
};

// ------------------------------------------------------------------ state

type Phase = 'user' | 'thinking' | 'engine' | 'study' | 'over';

let prefs: Progress = load();
let side: Side = 'w';
let level: Level = levelOf(prefs.level);
let orientation: Side = 'w';
let chess = new Chess();
let fens: string[] = [START];
let ucis: string[] = [];
let sans: string[] = [];
let verdicts: (Verdict | null)[] = [];
let phase: Phase = 'user';
let gen = 0;
let pre: { fen: string; done: Promise<Analysis> } | null = null;
let hintStep = 0;
let warning: string | null = null;
let result: 'win' | 'loss' | 'draw' | 'resigned' | null = null;
/** two players on one phone: side is then whoever moves next, and nothing goes into the learner's record */
let friend = false;
const colourName = (s: Side) => (s === 'w' ? 'të bardhat' : 'të zezat');
const Cap = (t: string) => t[0].toUpperCase() + t.slice(1);
let board: BoardView;
let lastVerdict: Verdict | null = null;
/** the bot's moves in a row with its game lost beyond hope (a person resigns after a few) */
let hopelessRun = 0;
/** the bot's own value of the position before its last move (centipawns, its side): a big drop after it is a slip it notices */
let botBefore: number | null = null;
/** the bot says once a game that it is ahead, and once that it is behind */
let saidAhead = false;
let saidBehind = false;
let boardReady = false;
/** the position's value after each move, centipawns for white (mate is +-1000) */
let evals: (number | null)[] = [];
interface Clock {
  base: number;
  inc: number;
  w: number;
  b: number;
}
let clock: Clock | null = null;
const CLOCKS: Record<string, [number, number] | null> = { none: null, '10+0': [10, 0], '5+3': [5, 3], '3+2': [3, 2] };
const makeClock = (key: string): Clock | null => {
  const c = CLOCKS[key];
  return c ? { base: c[0] * 60000, inc: c[1] * 1000, w: c[0] * 60000, b: c[0] * 60000 } : null;
};
/** A search's value in centipawns for white. */
function whiteCp(a: Analysis, fenAt: string): number | null {
  const l = a.lines[0];
  if (!l) return null;
  const s = l.mate !== undefined ? (l.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, l.cp ?? 0));
  return fenAt.split(' ')[1] === 'w' ? s : -s;
}
/** After the game ends on the board: the value of the final position. */
const finalCp = () => (chess.isCheckmate() ? (chess.turn() === 'w' ? -1000 : 1000) : 0);

// the intro covers the table while the board and the engine load; it can be skipped at once
const intro = {
  el: $('[data-intro]'),
  pct: $('[data-intro-pct]'),
  shown: 0,
  target: 0,
  done: false,
};
function introTo(share: number) {
  intro.target = Math.max(intro.target, share);
  if (!motionOn()) intro.shown = intro.target;
  if (intro.target >= 1) closeIntro();
}
function closeIntro() {
  if (intro.done) return;
  intro.done = true;
  intro.pct.textContent = '100%';
  intro.el.style.setProperty('--p', '1');
  if (!motionOn()) {
    intro.el.hidden = true;
    return;
  }
  // the launch screen dissolves the way iOS hands over to an app: it fades, blurs and grows a touch
  gsap.to(intro.el, { opacity: 0, filter: 'blur(14px)', scale: 1.04, duration: 0.45, ease: 'power2.out', delay: 0.15, onComplete: () => void (intro.el.hidden = true) });
}
$('[data-intro-skip]').addEventListener('click', closeIntro);
onTick((dt) => {
  if (intro.done) return;
  intro.shown += (intro.target - intro.shown) * Math.min(1, dt * 6);
  intro.pct.textContent = `${Math.round(intro.shown * 100)}%`;
  intro.el.style.setProperty('--p', intro.shown.toFixed(3));
});
introTo(0.12);

const engine = new Engine();
engine.ready.then(
  () => {
    status();
    introTo(boardReady ? 1 : 0.5);
  },
  () => {
    ui.status.textContent = 'Motori nuk u ngarkua. Rifresko faqen.';
  },
);

const fen = () => fens[fens.length - 1];
const BAD: Grade[] = ['inaccuracy', 'mistake', 'blunder'];
const TIPS = [
  'Para çdo lëvizjeje pyet: çfarë kërcënon kundërshtari?',
  'Kontrollo kapjet, shahet dhe kërcënimet, në këtë rend',
  'Zhvillo kuajt dhe oficerët para mbretëreshës',
  'Bëj rokadë herët: mbreti rri më i sigurt në cep',
  'Një figurë pa mbrojtje është një figurë në rrezik',
  'Kur je përpara në material, shkëmbe figura',
  'Torrat duan kolona të hapura',
];
const turn = (): Side => chess.turn() as Side;
const coachSearch = () => ({ depth: Math.max(12, level.depth), movetime: level.movetime ?? 1800 });

// ------------------------------------------------------------------ board

function dests(sq: Sq): Sq[] {
  if (phase !== 'user' || turn() !== side) return [];
  const p = chess.get(sq as Square);
  if (!p || p.color !== side) return [];
  return chess.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
}

/** The board is always the 3D table (the flat one comes only where WebGL fails). */
async function mountBoard() {
  board?.dispose();
  board = await createBoard('3d', {
    host: ui.host,
    orientation,
    motion: motionOn,
    dests,
    onMove: (from, to) => void userMove(from, to),
    label: 'Tabela',
  });
  board.setPosition(fen(), false);
  marks();
  board.setInteractive(phase === 'user');
  document.querySelector<HTMLButtonElement>('[data-angle]')!.hidden = board.kind !== '3d';
}

function marks(extra: { arrows?: Arrow[]; focus?: Sq[] } = {}) {
  const last = ucis.length ? ([ucis[ucis.length - 1].slice(0, 2), ucis[ucis.length - 1].slice(2, 4)] as [Sq, Sq]) : null;
  let check: Sq | null = null;
  if (chess.inCheck()) {
    for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === chess.turn()) check = p.square;
  }
  // the Show-threats switch: what the learner could lose next move, in red (not while a past move is open)
  const danger = prefs.threats && !study && phase !== 'over' ? inDanger(chess.fen(), side) : [];
  board.setMarks({ last, check, arrows: extra.arrows ?? [], focus: extra.focus ?? [], danger });
}

// ------------------------------------------------------------------ the game

function rebuild() {
  chess = new Chess(fens[0]);
  for (const u of ucis) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
}

function persist() {
  saveGame(result ? null : { fens, sans, ucis, side, level: level.id, verdicts, evals, clock, friend });
}

function newGame(s: Side, lv: Level, clk: string = prefs.clock, withFriend = false) {
  gen++;
  friend = withFriend;
  engine.newGame();
  side = s;
  level = lv;
  hopelessRun = 0;
  botBefore = null;
  saidAhead = saidBehind = false;
  seatOpponent(withFriend ? null : lv.id);
  resetChatter();
  clock = makeClock(clk);
  evals = [];
  orientation = s;
  board.setOrientation(s);
  chess = new Chess();
  fens = [START];
  ucis = [];
  sans = [];
  verdicts = [];
  result = null;
  lastVerdict = null;
  warning = null;
  board.setPosition(START, true);
  marks();
  ui.end.hidden = true;
  ui.review.open = false;
  showIntro();
  renderSheet();
  renderClock();
  persist();
  if (side === 'b') void engineMove();
  else userTurn();
}

function userTurn() {
  hintStep = 0;
  if (study) study.resume = 'user';
  else {
    phase = 'user';
    board.setInteractive(true);
  }
  status();
  const g = gen;
  const at = fen();
  // the threat first (quick), then the full look the grade and the hint will use
  if (prefs.warnings && ucis.length) {
    const passed = passTurn(at);
    if (passed)
      engine.analyse(passed, { depth: 9, movetime: 600 }).then((a) => {
        if (g !== gen || fen() !== at) return;
        warning = threatWarning(at, a);
        showWarning();
      });
  }
  pre = { fen: at, done: engine.analyse(at, { depth: 13, movetime: 2500, multipv: 2 }) };
  // the same look is the value of the engine's last move, for the graph
  const ply = ucis.length - 1;
  if (ply >= 0)
    pre.done.then((a) => {
      if (g !== gen || evals[ply] != null || !a.lines.length) return;
      evals[ply] = whiteCp(a, at);
      renderReview();
      persist();
    });
}

async function before(at: string): Promise<Analysis> {
  if (pre && pre.fen === at) {
    if (engine.busy) engine.hurry();
    const a = await pre.done;
    if (a.depth >= 9) return a;
  }
  return engine.analyse(at, { depth: 11, multipv: 2 });
}

let promoAsk: ((k: string | null) => void) | null = null;
function askPromotion(): Promise<string | null> {
  ui.promo.hidden = false;
  ui.promo.querySelector<HTMLButtonElement>('button')?.focus();
  return new Promise((resolve) => (promoAsk = resolve));
}
ui.promo.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('button[data-piece]');
  if (!b || !promoAsk) return;
  ui.promo.hidden = true;
  const r = promoAsk;
  promoAsk = null;
  r(b.dataset.piece === 'x' ? null : b.dataset.piece!);
});

async function userMove(from: Sq, to: Sq) {
  if (phase !== 'user') return;
  const piece = chess.get(from as Square);
  let promotion: string | undefined;
  if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
    const k = await askPromotion();
    if (!k) {
      board.setPosition(fen(), true);
      return;
    }
    promotion = k;
  }
  let m;
  try {
    m = chess.move({ from, to, promotion });
  } catch {
    board.setPosition(fen(), true);
    return;
  }
  const fenBefore = fen();
  const history = [...sans];
  const uci = m.from + m.to + (m.promotion ?? '');
  fens.push(chess.fen());
  ucis.push(uci);
  sans.push(m.san);
  moveSound(m.san);
  verdicts.push(null);
  evals.push(null);
  if (clock) clock[side] += clock.inc;
  warning = null;
  phase = 'thinking';
  board.setInteractive(false);
  board.setPosition(fen(), true);
  marks();
  renderSheet();
  say(`Ti: ${sentenceText(`[[${m.san}]]`)}.`);
  coachThinking(m.san);
  status();
  persist();

  const g = gen;
  const b = await before(fenBefore);
  if (g !== gen) return;
  const over = chess.isGameOver();
  const lv = level;
  const after: Analysis = over
    ? { fen: fen(), bestmove: null, depth: 0, lines: [] }
    : await engine.analyse(fen(), { ...coachSearch(), multipv: Math.max(1, lv.lines) });
  if (g !== gen) return;
  const v = judge({ fen: fenBefore, uci, history, before: b, after });
  verdicts[verdicts.length - 1] = v;
  evals[evals.length - 1] = over ? finalCp() : whiteCp(after, fen());
  renderReview();
  lastVerdict = v;
  if (!friend && !study && botBefore !== null && b.lines[0] && !BAD.includes(v.grade) && lineScore(b.lines[0]) + botBefore >= 250) speak(level.id, 'oops', ucis.length, 0.75);
  renderVerdict(v, true);
  renderSheet();
  persist();
  if (!friend) {
    if (v.tags.length) update((p) => v.tags.forEach((t) => (p.tags[t] = (p.tags[t] ?? 0) + 1)));
    // a mistake becomes a puzzle that comes back on a schedule
    addCard(v);
  }
  if (over) return endGame();
  // a friend across the table: the other side moves now, on the same phone
  if (friend) {
    side = turn();
    return userTurn();
  }
  await engineMove(after);
}

async function engineMove(given?: Analysis) {
  if (study) study.resume = 'engine';
  else {
    phase = 'engine';
    board.setInteractive(false);
  }
  status();
  const g = gen;
  const started = performance.now();
  const a = given ?? (await engine.analyse(fen(), { ...coachSearch(), multipv: Math.max(1, level.lines) }));
  if (g !== gen) return;
  const legal = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
  // a lost game: the stronger bots resign after a few moves of it, as people do (never inside a replayed line)
  // one move that looks a little less bad does not undo the others
  hopelessRun = level.resigns && !study ? (hopeless(a) ? hopelessRun + 1 : Math.max(0, hopelessRun - 1)) : 0;
  if (hopelessRun >= 3) {
    await new Promise((r) => setTimeout(r, 900));
    if (g !== gen) return;
    return endGame(false, null, true);
  }
  const uci = pickMove(a, level, fen(), legal);
  if (!uci) return endGame();
  const botCp = a.lines[0] ? lineScore(a.lines[0]) : null;
  botBefore = botCp;
  // a person's time over the move: quick on a recapture or with one move, longer when it is hard (and never less
  // than a beat, so the learner sees their own move land)
  const last = chess.history({ verbose: true }).at(-1);
  const recapture = !!last?.captured && uci.slice(2, 4) === last.to;
  const think = study ? 250 : thinkTime(level, a, legal.length, chess.history().length, recapture);
  const wait = Math.max(0, Math.max(motionOn() ? 650 : 250, think) - (performance.now() - started));
  // a long think, now and then, comes with a thought
  if (!study && !friend && wait > 2400) speak(level.id, 'think', ucis.length, 0.3);
  await new Promise((r) => setTimeout(r, wait));
  if (g !== gen) return;
  const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
  fens.push(chess.fen());
  ucis.push(uci);
  sans.push(m.san);
  moveSound(m.san);
  verdicts.push(null);
  evals.push(chess.isGameOver() ? finalCp() : null);
  if (clock) {
    const mover: Side = side === 'w' ? 'b' : 'w';
    clock[mover] += clock.inc;
  }
  if (!study) {
    board.setPosition(fen(), true);
    marks();
  }
  // the punishment came: the coach says so in the past tense
  const mine = verdicts[verdicts.length - 2];
  if (mine && mine === lastVerdict && BAD.includes(mine.grade) && mine.refutation[1] === uci && !study && phase !== 'over') {
    ui.reasons.innerHTML = afterReply(mine, uci).map((r) => `<li>${sentenceHtml(r)}</li>`).join('');
  }
  if (!study && !friend && !chess.isGameOver()) {
    // the learner's slip punished: they say so; otherwise, once a game, when it turns
    const ply = ucis.length;
    if (mine && BAD.includes(mine.grade) && mine.grade !== 'inaccuracy' && mine.refutation[1] === uci) speak(level.id, 'pounce', ply, 0.8);
    else if (botCp !== null && botCp >= 400 && !saidAhead) {
      saidAhead = true;
      speak(level.id, 'ahead', ply, 0.9);
    } else if (botCp !== null && botCp <= -400 && !saidBehind) {
      saidBehind = true;
      speak(level.id, 'behind', ply, 0.9);
    }
  }
  renderSheet();
  say(`Kundërshtari: ${sentenceText(`[[${m.san}]]`)}${chess.inCheck() ? ', shah' : ''}.`);
  persist();
  if (chess.isGameOver()) return endGame();
  userTurn();
}

function takeBack(message: string) {
  if (phase === 'study') leaveStudy(false);
  gen++;
  engine.cancelAll();
  // back to the learner's turn before their last move: the side to move after a pop made the popped move (with a
  // friend, one move back is the other player's retry)
  while (ucis.length) {
    fens.pop();
    ucis.pop();
    sans.pop();
    verdicts.pop();
    evals.pop();
    rebuild();
    if (friend) {
      side = turn();
      break;
    }
    if (turn() === side) break;
  }
  result = null;
  ui.end.hidden = true;
  board.setPosition(fen(), true);
  marks();
  renderSheet();
  persist();
  lastVerdict = [...verdicts].reverse().find(Boolean) ?? null;
  showNote('Provo përsëri', message);
  if (turn() === side) userTurn();
  else void engineMove();
}

function endGame(resigned = false, flagged: Side | null = null, botResigned = false) {
  if (study) leaveStudy();
  phase = 'over';
  gen++;
  engine.cancelAll();
  board.setInteractive(false);
  let res: 'win' | 'loss' | 'draw' | 'resigned';
  let headline: string;
  let line: string;
  if (friend && (resigned || flagged || chess.isCheckmate())) {
    // between two players: the side to move resigns or ran out of time or is mated, and the other colour wins
    const loser: Side = flagged ?? turn();
    const winner: Side = loser === 'w' ? 'b' : 'w';
    res = 'win';
    headline = `Fitojnë ${colourName(winner)}`;
    line = resigned ? `${Cap(colourName(loser))} u dorëzuan.` : flagged ? `${Cap(colourName(loser))} mbetën pa kohë.` : 'Shah mat.';
  } else if (botResigned) {
    res = 'win';
    headline = 'Fitore';
    line = `${level.bot} u dorëzua. E pa që loja ishte e humbur.`;
  } else if (resigned) {
    res = 'resigned';
    headline = 'Dorëzim';
    line = 'U dorëzove. Rishiko lojën dhe gjej ku ndryshoi pozicioni.';
  } else if (flagged) {
    res = flagged === side ? 'loss' : 'win';
    headline = res === 'win' ? 'Fitore' : 'Humbje';
    line = res === 'win' ? 'Motorit i mbaroi koha.' : 'Të mbaroi koha. Me orë, edhe koha është material.';
  } else if (chess.isCheckmate()) {
    res = turn() === side ? 'loss' : 'win';
    headline = res === 'win' ? 'Fitore' : 'Humbje';
    line = res === 'win' ? 'Shah mat. E fitove lojën.' : 'Shah mat. Kundërshtari e fitoi lojën.';
  } else {
    res = 'draw';
    headline = 'Barazim';
    line = chess.isStalemate()
      ? 'Pat: mbreti nuk është në shah, por nuk ka asnjë lëvizje të ligjshme.'
      : chess.isThreefoldRepetition()
        ? 'I njëjti pozicion u përsërit tri herë.'
        : chess.isInsufficientMaterial()
          ? 'Nuk ka mbetur material i mjaftueshëm për mat.'
          : 'Pesëdhjetë lëvizje pa kapje dhe pa lëvizje ushtari.';
  }
  result = res;
  if (!friend) speak(level.id, botResigned ? 'resign' : res === 'win' ? 'lost' : res === 'draw' ? 'draw' : 'won', ucis.length);
  if (res === 'win') winSound();
  if (chess.isCheckmate()) mateFall(() => board, chess.fen(), fen);
  const mine = verdicts.filter((v): v is Verdict => !!v);
  const acc = gameAccuracy(mine);
  const count = (g: Grade) => mine.filter((v) => v.grade === g).length;
  const tagCounts = new Map<string, number>();
  mine.forEach((v) => v.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const topTag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  // a game between two friends stays out of the learner's record
  if (!friend) update((p) => {
    p.games.push({
      date: new Date().toISOString(),
      side,
      level: level.id,
      result: res,
      moves: Math.ceil(ucis.length / 2),
      accuracy: acc === null ? null : Math.round(acc),
      blunders: count('blunder'),
      mistakes: count('mistake'),
      opening: openingOf(sans)?.name ?? null,
    });
  });
  saveGame(null);
  ui.end.hidden = false;
  ui.coach.dataset.state = 'end';
  ui.coach.dataset.grade = '';
  ui.glyph.textContent = headline;
  ui.title.textContent = 'Fund i lojës';
  ui.reasons.innerHTML = '';
  ui.warning.hidden = true;
  ui.end.querySelector('[data-end-line]')!.textContent = line;
  ui.end.querySelector('[data-end-acc]')!.textContent = acc === null ? 'Asnjë lëvizje' : `${Math.round(acc)}%`;
  ui.end.querySelector('[data-end-counts]')!.innerHTML = (['blunder', 'mistake', 'inaccuracy'] as Grade[])
    .map((g) => `<li><span class="ann">${GRADES[g].symbol}</span> ${GRADES[g].title}: <b class="tabular">${count(g)}</b></li>`)
    .join('');
  ui.end.querySelector('[data-end-tag]')!.textContent = topTag ? `Më shpesh: ${TAG_NAMES[topTag[0] as keyof typeof TAG_NAMES].toLowerCase()} (${topTag[1]}).` : 'Asnjë gabim i përsëritur.';
  status();
  say(`${headline}. ${line}`);
  wipeIn();
  ticker();
  renderClock();
  renderReview();
  ui.review.open = true;
}

// ------------------------------------------------------------------ the coach panel

function status() {
  let t: string;
  if (engine.state === 'loading') t = 'Motori po ngarkohet…';
  else if (phase === 'over') t = 'Loja mbaroi.';
  else if (phase === 'thinking') t = 'Trajneri po e shikon lëvizjen…';
  else if (phase === 'engine') t = `${level.bot} po mendon…`;
  else if (phase === 'study') t = 'Loja pret.';
  else if (friend) t = `${chess.inCheck() ? 'Shah! ' : ''}Radha e ${turn() === 'w' ? 'të bardhave' : 'të zezave'}.`;
  else t = chess.inCheck() ? 'Shah! Radha jote.' : 'Radha jote.';
  ui.status.textContent = t;
  const op = openingOf(sans);
  ui.opening.textContent = op ? op.name : '';
  ui.opening.hidden = !op;
  ui.undo.disabled = ucis.length === 0 || phase === 'study';
  const latest = [...verdicts].reverse().find(Boolean) ?? null;
  ui.retry.hidden = !(latest && BAD.includes(latest.grade) && (phase === 'user' || phase === 'engine'));
  ui.why.hidden = !lastVerdict || phase === 'over';
  ui.hint.hidden = phase !== 'user';
  ui.resign.hidden = phase === 'over';
  renderPlayers();
}

function showIntro() {
  ui.coach.dataset.state = 'intro';
  ui.coach.dataset.grade = '';
  if (friend) {
    ui.glyph.innerHTML = 'Dy lojtarë';
    ui.title.textContent = 'Të bardhat fillojnë.';
    ui.reasons.innerHTML = '<li>Lëvizni me radhë në të njëjtin telefon. Trajneri e vlerëson çdo lëvizje, për të dy.</li>';
    showWarning();
    return;
  }
  ui.glyph.innerHTML = side === 'w' ? 'Radha jote' : `Fillon ${level.bot}`;
  ui.title.textContent = `Ti luan me ${side === 'w' ? 'të bardhat' : 'të zezat'}. Kundërshtari: ${level.bot}, niveli ${level.n}.`;
  ui.reasons.innerHTML = `<li>Pas çdo lëvizjeje trajneri të thotë si ishte dhe pse. Prek një figurë, pastaj fushën ku do ta çosh.</li>`;
  showWarning();
}

function showNote(title: string, text: string) {
  wipeIn();
  ui.coach.dataset.state = 'note';
  ui.coach.dataset.grade = '';
  ui.glyph.textContent = title;
  ui.title.textContent = '';
  ui.reasons.innerHTML = `<li>${sentenceHtml(text)}</li>`;
  status();
}

function coachThinking(san: string) {
  ui.coach.dataset.state = 'thinking';
  ui.coach.dataset.grade = '';
  ui.glyph.innerHTML = sanHtml(san);
  ui.title.textContent = 'Trajneri po e shikon…';
  ui.reasons.innerHTML = '';
  ui.warning.hidden = true;
}

function renderVerdict(v: Verdict, fresh: boolean) {
  ui.coach.dataset.state = 'verdict';
  ui.coach.dataset.grade = v.grade;
  ui.glyph.innerHTML = `${sanHtml(v.san)}<span class="ann">${v.symbol}</span>`;
  ui.title.textContent = v.title;
  // a verdict shown again after the answer was played tells it in the past
  const i = verdicts.indexOf(v);
  const answer = i >= 0 ? ucis[i + 1] : undefined;
  ui.reasons.innerHTML = (answer ? afterReply(v, answer) : v.reasons).map((r) => `<li>${sentenceHtml(r)}</li>`).join('');
  say(`${v.title}. ${v.reasons.map(sentenceText).join(' ')}`);
  if (fresh) wipeIn();
  showWarning();
  status();
  ticker();
}

function showWarning() {
  ui.warning.hidden = !warning || phase !== 'user';
  ui.warning.innerHTML = warning ? sentenceHtml(warning) : '';
  ticker();
}

function wipeIn() {
  if (!motionOn()) return;
  const parts = [ui.tag, ui.coach.querySelector('.lower__head'), ui.coach.querySelector('.lower__body')];
  gsap.fromTo(parts, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.34, stagger: 0.07, ease: 'power3.out', clearProps: 'clipPath' });
}

function ticker() {
  const items: string[] = [];
  const op = openingOf(sans);
  if (op) items.push(op.name);
  items.push(friend ? 'Dy lojtarë në një telefon' : `${level.bot}: niveli ${level.n}, ${level.name.toLowerCase()}`);
  if (sans.length) items.push(`Lëvizja ${Math.ceil(sans.length / 2)}`);
  if (warning) items.push(sentenceText(warning));
  const v = [...verdicts].reverse().find(Boolean);
  if (v) items.push(`${sentenceText(`[[${v.san}]]`)}${v.symbol}: ${v.title}`);
  const tip = TIPS[sans.length % TIPS.length];
  items.push(tip, TIPS[(sans.length + 3) % TIPS.length]);
  const html = items.map((t) => `<span>${t.replace(/[<>&]/g, '')}</span>`).join('');
  ui.ticker.innerHTML = html + html;
  ui.ticker.style.setProperty('--crawl', `${Math.max(28, items.join(' ').length * 0.32)}s`);
}

function say(text: string) {
  ui.live.textContent = text;
}

// ------------------------------------------------------------------ hint

ui.hint.addEventListener('click', async () => {
  if (phase !== 'user' || !pre) return;
  const g = gen;
  const at = fen();
  ui.hint.setAttribute('aria-busy', 'true');
  if (hintStep === 0) showNote('Ndihmë', 'Trajneri po kërkon lëvizjen më të mirë…');
  const a = await pre.done;
  ui.hint.removeAttribute('aria-busy');
  if (g !== gen || fen() !== at) return;
  const best = a.lines[0]?.pv[0] ?? a.bestmove;
  if (!best) return;
  const from = best.slice(0, 2);
  const to = best.slice(2, 4);
  const san = uciSan(at, best);
  hintStep = Math.min(2, hintStep + 1);
  if (hintStep === 1) {
    const idea = a.lines[0]?.mate !== undefined && a.lines[0].mate > 0 ? 'Ka mat! Kërko lëvizjen që e jep.' : san.includes('x') ? 'Kërko një kapje.' : san.includes('+') ? 'Kërko një shah.' : 'Lëviz figurën e shënuar.';
    marks({ focus: [from] });
    showNote('Ndihmë', `${idea} Shtyp përsëri për lëvizjen e plotë.`);
  } else {
    marks({ focus: [from], arrows: [{ from, to }] });
    showNote('Ndihmë', `Lëvizja më e mirë: [[${san}]].`);
  }
});

// ------------------------------------------------------------------ study: show the line on the board

interface Study {
  from: string;
  line: string[];
  step: number;
  fens: string[];
  sans: string[];
  timer: gsap.core.Tween | null;
  resume: Phase;
  title: string;
}
let study: Study | null = null;

function enterStudy(from: string, line: string[], title: string) {
  const c = new Chess(from);
  const fs = [from];
  const ss: string[] = [];
  for (const u of line) {
    try {
      const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      fs.push(c.fen());
      ss.push(m.san);
    } catch {
      break;
    }
  }
  if (study?.timer) study.timer.kill();
  const resume = study?.resume ?? phase;
  study = { from, line: line.slice(0, ss.length), step: 0, fens: fs, sans: ss, timer: null, resume, title };
  phase = 'study';
  board.setInteractive(false);
  board.setPlate('ANALIZË');
  ui.coach.dataset.mode = 'study';
  document.documentElement.dataset.mode = 'study';
  // offer the other view only: the heading already names this one
  ui.studyWhy.hidden = title === 'Pse ishte gabim' || !lastVerdict || !BAD.includes(lastVerdict.grade);
  ui.studyBest.hidden = title === 'Lëvizja më e mirë' || !lastVerdict || !BAD.includes(lastVerdict.grade);
  ui.tag.textContent = 'Analizë';
  ui.liveTag.textContent = 'Analizë';
  ui.title.textContent = title;
  ui.study.querySelector('[data-study-line]')!.innerHTML = ss.map((s, i) => `<li data-i="${i}">${sanHtml(s)}</li>`).join('');
  board.setPosition(from, true);
  studyMarks();
  status();
  if (motionOn()) study.timer = gsap.delayedCall(0.55, autoStep);
}

function studyMarks() {
  if (!study) return;
  const arrows: Arrow[] = study.line.slice(0, study.step + 1).map((u, i) => ({ from: u.slice(0, 2), to: u.slice(2, 4), label: String(i + 1), tone: i === study!.step ? 'pointer' : 'quiet' }));
  const all: Arrow[] = study.line.map((u, i) => ({ from: u.slice(0, 2), to: u.slice(2, 4), label: String(i + 1), tone: i === study!.line.length - 1 ? 'pointer' : 'quiet' }));
  board.setMarks({ arrows: study.step < study.line.length ? arrows.slice(-2) : all, last: null });
  ui.study.querySelectorAll('[data-i]').forEach((li) => li.toggleAttribute('data-done', Number((li as HTMLElement).dataset.i) < study!.step));
  ui.prev.disabled = study.step === 0;
  ui.next.disabled = study.step >= study.line.length;
}

function stepStudy(d: number) {
  if (!study) return;
  study.step = Math.max(0, Math.min(study.line.length, study.step + d));
  board.setPosition(study.fens[study.step], true);
  studyMarks();
}

function autoStep() {
  if (!study || study.step >= study.line.length) return;
  stepStudy(1);
  study.timer = gsap.delayedCall(1.05, autoStep);
}

function leaveStudy(redraw = true) {
  if (!study) return;
  study.timer?.kill();
  const resume = study.resume;
  study = null;
  if (stripPly !== null) {
    stripPly = null;
    showInStrip(sans.length - 1);
  }
  ui.coach.dataset.mode = '';
  delete document.documentElement.dataset.mode;
  ui.tag.textContent = 'Trajneri';
  ui.liveTag.textContent = 'Drejtpërdrejt';
  if (lastVerdict && phase !== 'over') ui.title.textContent = lastVerdict.title;
  board.setPlate(null);
  phase = resume;
  if (redraw) {
    // the signature's last beat: every piece flies back to where the game stands
    board.setPosition(fen(), true);
    marks();
    board.setInteractive(phase === 'user');
    status();
  }
}

ui.why.addEventListener('click', () => {
  const v = lastVerdict;
  if (!v) return;
  const bad = BAD.includes(v.grade);
  if (bad) enterStudy(v.fen, v.refutation, 'Pse ishte gabim');
  else enterStudy(v.fen, v.refutation, 'Si vazhdon loja');
});
ui.studyWhy.addEventListener('click', () => lastVerdict && enterStudy(lastVerdict.fen, lastVerdict.refutation, 'Pse ishte gabim'));
ui.studyBest.addEventListener('click', () => lastVerdict && enterStudy(lastVerdict.fen, lastVerdict.bestLine, 'Lëvizja më e mirë'));
ui.prev.addEventListener('click', () => {
  study?.timer?.kill();
  stepStudy(-1);
});
ui.next.addEventListener('click', () => {
  study?.timer?.kill();
  stepStudy(1);
});
ui.back.addEventListener('click', () => leaveStudy());
ui.retry.addEventListener('click', () => takeBack('Gjej një lëvizje më të mirë. Ndihma të tregon figurën që duhet lëvizur.'));
ui.undo.addEventListener('click', () => takeBack('Lëvizja u kthye. Luaj diçka tjetër.'));

// ------------------------------------------------------------------ the scoresheet and the rail

function renderSheet() {
  const rows: string[] = [];
  const offset = fens[0].split(' ')[1] === 'b' ? 1 : 0;
  for (let i = 0; i < sans.length; i++) {
    const ply = i + offset;
    const v = verdicts[i];
    const mine = (ply % 2 === 0 ? 'w' : 'b') === side;
    const cell = `<button type="button" class="mv${mine ? ' mv--mine' : ''}" data-ply="${i}"${i === sans.length - 1 ? ' aria-current="true"' : ''}>${sanHtml(sans[i])}${v && v.symbol ? `<span class="ann" data-grade="${v.grade}">${v.symbol}</span>` : ''}</button>`;
    if (ply % 2 === 0) rows.push(`<li><span class="mv-n tabular">${Math.floor(ply / 2) + 1}</span>${cell}`);
    else if (i === 0) rows.push(`<li><span class="mv-n tabular">${Math.floor(ply / 2) + 1}</span><span class="mv mv--gap">…</span>${cell}</li>`);
    else rows[rows.length - 1] += `${cell}</li>`;
  }
  ui.sheet.innerHTML = rows.length ? rows.join('') : '<li class="sheet-empty">Lëvizjet do të shkruhen këtu.</li>';
  const rail = verdicts
    .map((v, i) => {
      const mine = ((i + offset) % 2 === 0 ? 'w' : 'b') === side;
      const g = v?.grade ?? (mine ? 'pending' : 'them');
      return `<i data-g="${g}"${i === verdicts.length - 1 ? ' data-now' : ''}></i>`;
    })
    .join('');
  ui.rail.innerHTML = rail;
  ui.rail.style.setProperty('--slots', String(Math.max(24, verdicts.length)));
  const bad = verdicts.filter((v) => v && BAD.includes(v.grade)).length;
  ui.rail.setAttribute('aria-label', `Rrjedha e lojës: ${sans.length} lëvizje, ${bad} gabime`);
  // the last moves as a scoresheet graphic beside the board (wide screens)
  const mini = document.querySelector('[data-mini-sheet]');
  if (mini) {
    const lis: string[] = [];
    for (let i = 0; i < sans.length; i++) {
      const ply = i + offset;
      const v = verdicts[i];
      const cell = `<span>${sanHtml(sans[i])}${v && v.symbol ? `<span class="ann">${v.symbol}</span>` : ''}</span>`;
      if (ply % 2 === 0 || i === 0) lis.push(`<li><span class="n">${Math.floor(ply / 2) + 1}</span>${ply % 2 === 1 ? '<span>…</span>' : ''}${cell}`);
      else lis[lis.length - 1] += cell;
    }
    mini.innerHTML = lis.slice(-6).map((l) => l + '</li>').join('');
  }
  renderStrip();
  status();
}

// the move strip over the board on a phone, as chess.com keeps it: every move in one line, sliding so the move on
// the board stays in view; a tap opens that move
function renderStrip() {
  if (!sans.length) {
    ui.strip.innerHTML = '<li class="strip__empty">Lëvizjet shfaqen këtu.</li>';
    return;
  }
  const offset = fens[0].split(' ')[1] === 'b' ? 1 : 0;
  const items: string[] = [];
  for (let i = 0; i < sans.length; i++) {
    const ply = i + offset;
    const v = verdicts[i];
    if (ply % 2 === 0 || i === 0) items.push(`<li class="strip__n tabular" aria-hidden="true">${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'}</li>`);
    items.push(`<li><button type="button" class="strip__mv" data-ply="${i}">${sanHtml(sans[i])}${v && v.symbol ? `<span class="ann" data-grade="${v.grade}">${v.symbol}</span>` : ''}</button></li>`);
  }
  ui.strip.innerHTML = items.join('');
  showInStrip(stripPly ?? sans.length - 1);
}
function showInStrip(i: number) {
  ui.strip.querySelectorAll('[aria-current]').forEach((b) => b.removeAttribute('aria-current'));
  const b = ui.strip.querySelector<HTMLElement>(`[data-ply="${i}"]`);
  if (!b) return;
  b.setAttribute('aria-current', 'true');
  const left = b.offsetLeft - (ui.strip.clientWidth - b.offsetWidth) / 2;
  ui.strip.scrollTo({ left: Math.max(0, left), behavior: motionOn() ? 'smooth' : 'instant' });
}
ui.strip.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-ply]');
  if (b) openPly(Number(b.dataset.ply));
});

ui.sheet.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-ply]');
  if (!b) return;
  openPly(Number(b.dataset.ply));
});

/** Show one move of the game on the board, with the coach's word on it. */
function openPly(i: number) {
  if (i < 0 || i >= ucis.length) return;
  stripPly = i;
  showInStrip(i);
  const v = verdicts[i];
  if (v) {
    lastVerdict = v;
    renderVerdict(v, false);
    enterStudy(v.fen, BAD.includes(v.grade) ? v.bestLine : [ucis[i]], `Lëvizja ${Math.floor(i / 2) + 1}`);
  } else {
    enterStudy(fens[i], [ucis[i]], `Lëvizja ${Math.floor(i / 2) + 1}`);
  }
  document.querySelector('.stage')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto', block: 'start' });
}

// ------------------------------------------------------------------ the graph of the game

/** The learner's move that cost the most winning chances, if any cost at least a tenth. */
function turning(): number | null {
  let best: number | null = null;
  let drop = 10;
  verdicts.forEach((v, i) => {
    if (!v) return;
    const d = v.winBefore - v.winAfter;
    if (d > drop) {
      drop = d;
      best = i;
    }
  });
  return best;
}

function renderReview() {
  const n = evals.length;
  const svg = ui.reviewSvg;
  if (n < 2) {
    svg.innerHTML = '';
    ui.reviewCap.textContent = 'Grafiku shfaqet pas disa lëvizjeve.';
    ui.turning.hidden = true;
    return;
  }
  // white's share of the chances, 0 (black wins) to 1 (white wins); a missing value repeats the last known
  let last = 20;
  const share = evals.map((e) => {
    if (e != null) last = e;
    return (winChance(last) + 1) / 2;
  });
  const pts = [[0, 0.52], ...share.map((v, i) => [((i + 1) / n) * 1000, v])];
  const y = (v: number) => (196 - v * 192).toFixed(1);
  const line = pts.map(([x, v]) => `${x.toFixed(1)} ${y(v)}`).join(' L');
  const marks = verdicts
    .map((v, i) => (v && (v.grade === 'mistake' || v.grade === 'blunder') ? `<line class="review__mark" x1="${(((i + 1) / n) * 1000).toFixed(1)}" x2="${(((i + 1) / n) * 1000).toFixed(1)}" y1="0" y2="200"/>` : ''))
    .join('');
  svg.innerHTML =
    `<rect class="review__bg" width="1000" height="200"/>` +
    `<path class="review__area" d="M0 200 L${line} L1000 200 Z"/>` +
    `<line class="review__mid" x1="0" x2="1000" y1="100" y2="100"/>` +
    marks;
  const t = turning();
  const v = t !== null ? verdicts[t] : null;
  const errors = verdicts.filter((x) => x && (x.grade === 'mistake' || x.grade === 'blunder')).length;
  ui.reviewCap.innerHTML = v
    ? sentenceHtml(`Momenti kyç: lëvizja ${Math.floor(t! / 2) + 1}, [[${v.san}]]${v.symbol}. Shanset e tua ranë nga ${Math.round(v.winBefore)}% në ${Math.round(v.winAfter)}%. Vijat e kuqe janë gabimet (${errors}).`)
    : 'Asnjë lëvizje nuk e ndryshoi lojën shumë. Pjesa e çelët tregon shanset e të bardhave.';
  ui.turning.hidden = t === null;
}

ui.reviewSvg.addEventListener('click', (e) => {
  const r = ui.reviewSvg.getBoundingClientRect();
  const n = evals.length;
  if (!n) return;
  const i = Math.round(((e.clientX - r.left) / r.width) * n) - 1;
  openPly(Math.max(0, Math.min(n - 1, i)));
});
ui.turning.addEventListener('click', () => {
  const t = turning();
  if (t !== null) openPly(t);
});

// ------------------------------------------------------------------ the clock

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return s.toFixed(1);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
/** the colour at the near edge: the learner, or with a friend whoever sits on the board's near side */
const seat = (): Side => (friend ? orientation : side);
function renderClock() {
  const near = seat();
  const rows: [HTMLElement, Side][] = [
    [ui.you, near],
    [ui.them, near === 'w' ? 'b' : 'w'],
  ];
  for (const [row, s] of rows) {
    const el = row.querySelector<HTMLElement>('[data-clock]')!;
    el.hidden = !clock;
    if (!clock) continue;
    const t = fmt(clock[s]);
    if (el.textContent !== t) el.textContent = t;
    el.toggleAttribute('data-low', clock[s] < 20000);
  }
}
onTick((dt) => {
  if (!clock || result || study || document.hidden) return;
  if (phase !== 'user' && phase !== 'engine') return;
  const mover = turn();
  clock[mover] -= dt * 1000;
  if (clock[mover] <= 0) {
    clock[mover] = 0;
    renderClock();
    endGame(false, mover);
    return;
  }
  renderClock();
});

/** the captured pieces each side showed last time, so only a new one pops in */
const takenSeen = new Map<string, Record<string, number>>();
function renderPlayers() {
  // what each side has taken, from the pieces missing on the board
  const full: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const have: Record<'w' | 'b', Record<string, number>> = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of chess.board()) for (const p of row) if (p && p.type !== 'k') have[p.color][p.type]++;
  const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const takenBy = (taker: Side) => {
    const victim: Side = taker === 'w' ? 'b' : 'w';
    let points = 0;
    const counts: Record<string, number> = {};
    for (const k of ['q', 'r', 'b', 'n', 'p']) {
      counts[k] = Math.max(0, full[k] - have[victim][k]);
      points += counts[k] * val[k];
    }
    return { html: takenIcons(takenSeen, taker, victim, counts), points };
  };
  const near = seat();
  const me = takenBy(near);
  const op = takenBy(near === 'w' ? 'b' : 'w');
  const diff = me.points - op.points;
  writeTaken(ui.you.querySelector('[data-taken]')!, me.html + (diff > 0 ? `<span class="adv tabular">+${diff}</span>` : ''));
  writeTaken(ui.them.querySelector('[data-taken]')!, op.html + (diff < 0 ? `<span class="adv tabular">+${-diff}</span>` : ''));
  ui.them.querySelector('[data-name]')!.textContent = friend ? Cap(colourName(near === 'w' ? 'b' : 'w')) : `${level.bot} · Niveli ${level.n}`;
  ui.you.querySelector('.score__name')!.textContent = friend ? Cap(colourName(near)) : 'Ti';
  ui.them.toggleAttribute('data-turn', friend ? phase === 'user' && turn() !== near : phase === 'engine');
  ui.you.toggleAttribute('data-turn', friend ? phase === 'user' && turn() === near : phase === 'user');
}

// ------------------------------------------------------------------ setup, flip, view, resign

function openSetup() {
  ui.setupDialog.showModal();
  ui.setup.querySelector<HTMLInputElement>(`input[name="opponent"][value="${prefs.opponent}"]`)!.checked = true;
  ui.setup.querySelector<HTMLInputElement>(`input[name="side"][value="${prefs.side}"]`)!.checked = true;
  deal();
  ui.setup.querySelector<HTMLInputElement>(`input[name="level"][value="${level.id}"]`)!.checked = true;
  requestAnimationFrame(() => centreCard(false));
  ui.setup.querySelector<HTMLInputElement>(`input[name="clock"][value="${prefs.clock}"]`)!.checked = true;
  ui.setup.querySelector<HTMLElement>('[data-setup-title]')?.focus();
}
ui.setupOpen.addEventListener('click', openSetup);
ui.setupClose.addEventListener('click', () => ui.setupDialog.close());
ui.setup.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(ui.setup);
  const s = String(data.get('side')) as Side | 'random';
  const n = Number(data.get('level'));
  const clk = String(data.get('clock') ?? 'none');
  const picked = data.get('opponent');
  const opponent = picked === 'friend' ? 'friend' : 'engine';
  prefs = update((p) => {
    p.side = s;
    if (picked !== 'online') {
      p.level = n;
      p.opponent = opponent;
    }
    p.clock = clk;
  });
  const card = ui.setup.querySelector<HTMLImageElement>('input[name="level"]:checked ~ .card__art img');
  const from = opponent === 'engine' && picked !== 'online' ? (card?.getBoundingClientRect() ?? null) : null;
  ui.setupDialog.close();
  // a friend on their own phone: the online page makes the room and hands over the link
  if (picked === 'online') return void (location.href = `/online/?krijo=1&ana=${s}&ora=${encodeURIComponent(clk)}`);
  if (opponent === 'friend') return newGame('w', levelOf(n), clk, true);
  newGame(s === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : s, levelOf(n));
  void fly(from, card?.currentSrc || card?.src || '').then(() => speak(level.id, 'hello', 0));
});
/** The deck of player cards: each opponent's portrait, level, how they play, and the learner's score against them. */
function deal() {
  const p = load();
  ui.setup.querySelector('[data-levels]')!.innerHTML = LEVELS.map((l) => {
    const sc = scoreVs(p, l.id);
    const played = sc.won + sc.drawn + sc.lost;
    return `<label class="card"><input type="radio" name="level" value="${l.id}" aria-describedby="card-${l.id}"><span class="card__art"><img src="${portrait(l.id, 320)}" srcset="${portrait(l.id, 320)} 320w, ${portrait(l.id, 560)} 560w" sizes="12rem" width="320" height="400" alt="" decoding="async"></span><span class="card__n" aria-hidden="true">${l.n}</span><span class="card__body"><b class="card__name">${l.bot}</b><span class="card__level">Niveli ${l.n}, ${l.name.toLowerCase()}</span><span class="card__note" id="card-${l.id}">${l.note}</span><span class="card__score${played ? '' : ' card__score--none'}">${scoreWords(sc)}</span></span></label>`;
  }).join('');
}
deal();
const deck = ui.setup.querySelector<HTMLElement>('[data-levels]')!;
/** the chosen card in the middle of the deck */
function centreCard(smooth: boolean) {
  const c = deck.querySelector<HTMLElement>('input:checked')?.closest<HTMLElement>('.card');
  if (!c) return;
  deck.scrollTo({ left: c.offsetLeft - (deck.clientWidth - c.offsetWidth) / 2, behavior: smooth && motionOn() ? 'smooth' : 'instant' });
}
deck.addEventListener('change', () => centreCard(true));
ui.setup.querySelectorAll<HTMLButtonElement>('[data-deck-step]').forEach((b) =>
  b.addEventListener('click', () => {
    const radios = [...deck.querySelectorAll<HTMLInputElement>('input')];
    const i = radios.findIndex((r) => r.checked);
    const next = radios[Math.max(0, Math.min(radios.length - 1, i + Number(b.dataset.deckStep)))];
    next.checked = true;
    centreCard(true);
  }),
);

// the game so far, opened on the analysis board
$('[data-analyse]').addEventListener('click', () => {
  try {
    sessionStorage.setItem('shah.analyse', chess.pgn());
  } catch {
    /* blocked storage: the board opens empty */
  }
  location.href = '/analizo/';
});

const threatsBtn = $<HTMLButtonElement>('[data-threats]');
threatsBtn.setAttribute('aria-pressed', String(prefs.threats));
threatsBtn.addEventListener('click', () => {
  prefs = update((p) => (p.threats = !p.threats));
  threatsBtn.setAttribute('aria-pressed', String(prefs.threats));
  say(prefs.threats ? 'Rreziqet shfaqen me të kuqe.' : 'Rreziqet nuk shfaqen.');
  marks();
});

const angleBtn = $<HTMLButtonElement>('[data-angle]');
angleBtn.addEventListener('click', () => {
  const name = board.cycleAngle?.();
  if (name) say(name);
});

ui.flip.addEventListener('click', () => {
  orientation = orientation === 'w' ? 'b' : 'w';
  board.setOrientation(orientation);
  renderPlayers();
  renderClock();
});

let resignArmed: ReturnType<typeof setTimeout> | null = null;
ui.resign.addEventListener('click', () => {
  if (phase === 'over') return;
  const label = ui.resign.querySelector('[data-label]')!;
  if (!resignArmed) {
    label.textContent = 'Konfirmo dorëzimin';
    resignArmed = setTimeout(() => {
      label.textContent = 'Dorëzohu';
      resignArmed = null;
    }, 3500);
    return;
  }
  clearTimeout(resignArmed);
  resignArmed = null;
  label.textContent = 'Dorëzohu';
  endGame(true);
});

ui.end.querySelector('[data-again]')!.addEventListener('click', () => {
  if (friend) return newGame('w', level, prefs.clock, true);
  newGame(side, level);
  speak(level.id, 'hello', 0);
});
ui.end.querySelector('[data-review]')!.addEventListener('click', () => {
  ui.review.open = true;
  ui.review.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto', block: 'start' });
  const t = turning();
  if (t !== null) openPly(t);
});

// ------------------------------------------------------------------ start

onMotion((on) => board?.setMotion(on));
onTick((dt) => board?.tick(dt));
keepBoardStill(ui.host, ui.coach, () => board);
keyboard(ui.host, () => board, () => orientation);

(async () => {
  const saved = loadGame();
  if (saved && saved.ucis.length) {
    side = saved.side;
    level = levelOf(saved.level);
    orientation = side;
    fens = saved.fens;
    ucis = saved.ucis;
    sans = saved.sans;
    verdicts = saved.verdicts as (Verdict | null)[];
    evals = saved.evals ?? saved.ucis.map(() => null);
    clock = saved.clock ?? null;
    friend = saved.friend ?? false;
    rebuild();
    if (friend) {
      orientation = 'w';
      side = turn();
    }
  } else {
    side = prefs.side === 'b' ? 'b' : 'w';
    orientation = side;
  }
  seatOpponent(friend ? null : level.id);
  await mountBoard();
  boardReady = true;
  // the table is what the intro hides; the engine can finish loading behind it (the live bug says so)
  introTo(1);
  renderSheet();
  renderReview();
  renderClock();
  lastVerdict = [...verdicts].reverse().find(Boolean) ?? null;
  if (lastVerdict) renderVerdict(lastVerdict, false);
  else showIntro();
  if (chess.isGameOver()) endGame();
  else if (turn() === side) userTurn();
  else void engineMove();
  // a fresh table: the opponent says hello once the intro has gone
  if (!saved?.ucis.length && !friend) setTimeout(() => !ucis.length && speak(level.id, 'hello', 0), 1400);
})();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__play = {
    state: () => ({ phase, fen: fen(), sans: [...sans], side, friend, level: level.id, verdicts: verdicts.map((v) => v && { grade: v.grade, reasons: v.reasons }) }),
    engine: () => engine.state,
    move: (from: Sq, to: Sq) => userMove(from, to),
    // tests: play the engine at another strength without touching the saved preference
    setLevel: (n: number) => (level = levelOf(n)),
  };
}
