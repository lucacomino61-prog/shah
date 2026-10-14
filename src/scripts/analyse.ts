// Analizo: any position with the engine's three best lines, set up by hand or reached by playing both sides, and
// a whole game (from chess.com, Lichess or a pasted PGN) reviewed move by move by the coach, the learner's own
// mistakes kept as puzzles. Everything runs in the browser; the two sites are asked only for the learner's games.

import { Chess, type Move, type Square } from 'chess.js';
import { gameAccuracy, judge, winChance, type Verdict } from '../lib/coach.ts';
import { Engine, type Analysis, type Line } from '../lib/engine.ts';
import { sanHtml, sentenceHtml, sentenceText } from '../lib/notation.ts';
import { openingOf } from '../lib/openings.ts';
import { moveSound } from '../lib/sound.ts';
import { addCard } from '../lib/store.ts';
import { createBoard, followBroadcast, keyboard, type BoardView } from './board/index.ts';
import type { Arrow, Side, Sq } from './board/types.ts';
import { motionOn, onMotion, onTick } from './shell.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const START = new Chess().fen();
const ui = {
  host: $('[data-board]'),
  status: $('[data-status]'),
  evalText: $('[data-eval]'),
  evalBar: $('[data-eval-bar]'),
  turnLabel: $('[data-turn-label]'),
  strip: $('[data-strip]'),
  coach: $('[data-coach]'),
  glyph: $('[data-glyph]'),
  title: $('[data-title]'),
  reasons: $('[data-reasons]'),
  lines: $('[data-lines]'),
  editor: $('[data-editor]'),
  prev: $<HTMLButtonElement>('[data-prev]'),
  next: $<HTMLButtonElement>('[data-next]'),
  best: $<HTMLButtonElement>('[data-best]'),
  clear: $<HTMLButtonElement>('[data-clear]'),
  done: $<HTMLButtonElement>('[data-done]'),
  edit: $<HTMLButtonElement>('[data-edit]'),
  promo: $('[data-promo]'),
  live: $('[data-live]'),
  sheet: $('[data-sheet]'),
  fetch: $<HTMLFormElement>('[data-fetch]'),
  fetchNote: $('[data-fetch-note]'),
  games: $('[data-games]'),
  paste: $<HTMLFormElement>('[data-paste]'),
  pasteNote: $('[data-paste-note]'),
  review: $('[data-review]'),
  reviewTitle: $('[data-review-title]'),
  reviewNote: $('[data-review-note]'),
  reviewRows: $('[data-review-rows]'),
  reviewSvg: $<SVGSVGElement>('[data-review-svg]'),
  reviewCap: $('[data-review-cap]'),
  turning: $<HTMLButtonElement>('[data-turning]'),
};

// ------------------------------------------------------------------ state

interface Ply {
  uci: string;
  san: string;
  fen: string;
}
let root = START;
let line: Ply[] = [];
/** the move on the board: -1 is the starting position */
let at = -1;
let orientation: Side = 'w';
let board: BoardView;
let editing = false;
let pen = 'wq';
let editMap = new Map<Sq, string>();
let lastAnalysis: Analysis | null = null;
interface Review {
  me: Side;
  verdicts: (Verdict | null)[];
  evals: (number | null)[];
  done: boolean;
  /** where the game came from, for the title */
  label: string;
}
let review: Review | null = null;
let reviewing = false;

const fenAt = (i = at) => (i < 0 ? root : line[i].fen);
const engine = new Engine();
// the engine can be ready before the 3D board has loaded: whichever comes second starts the first look
engine.ready.then(
  () => board && analyseNow(),
  () => (ui.status.textContent = 'Motori nuk u ngarkua. Rifresko faqen.'),
);

const say = (t: string) => (ui.live.textContent = t);
const sideToMove = (fen: string) => fen.split(' ')[1] as Side;

// ------------------------------------------------------------------ the board

function dests(sq: Sq): Sq[] {
  if (editing || reviewing) return [];
  const c = new Chess(fenAt());
  const p = c.get(sq as Square);
  if (!p || p.color !== c.turn()) return [];
  return c.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
}

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
  const c = new Chess(fenAt());
  const piece = c.get(from as Square);
  let promotion: string | undefined;
  if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
    ui.promo.hidden = false;
    const k = await new Promise<string | null>((r) => (promoAsk = r));
    if (!k) return board.setPosition(fenAt(), true);
    promotion = k;
  }
  let m: Move;
  try {
    m = c.move({ from, to, promotion });
  } catch {
    return board.setPosition(fenAt(), true);
  }
  playMove(m);
}

/** A move from the position on the board: the game's next move steps on; anything else starts a new line here. */
function playMove(m: Move) {
  const uci = m.from + m.to + (m.promotion ?? '');
  if (line[at + 1]?.uci === uci) return goTo(at + 1);
  if (review && at + 1 < line.length) {
    // leaving the game: the review belongs to its moves, so it steps aside
    review = null;
    renderReviewBox();
  }
  line = line.slice(0, at + 1);
  line.push({ uci, san: m.san, fen: m.after });
  at = line.length - 1;
  moveSound(m.san);
  board.setPosition(fenAt(), true);
  render();
  analyseNow();
}

function goTo(i: number, animate = true) {
  at = Math.max(-1, Math.min(line.length - 1, i));
  board.setPosition(fenAt(), animate);
  if (at >= 0 && animate) moveSound(line[at].san);
  render();
  analyseNow();
}

function marks(arrows: Arrow[] = []) {
  const last = at >= 0 ? ([line[at].uci.slice(0, 2), line[at].uci.slice(2, 4)] as [Sq, Sq]) : null;
  const c = new Chess(fenAt());
  let check: Sq | null = null;
  if (c.inCheck()) for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === c.turn()) check = p.square;
  board.setMarks({ last, check, arrows });
}

// ------------------------------------------------------------------ the engine's view

let agen = 0;
async function analyseNow() {
  if (!board || reviewing || editing || engine.state !== 'ready') return;
  const g = ++agen;
  const f = fenAt();
  engine.cancelAll();
  const c = new Chess(f);
  if (c.isGameOver()) {
    lastAnalysis = null;
    showEval(null, c);
    ui.lines.innerHTML = '';
    marks();
    ui.status.textContent = c.isCheckmate() ? 'Shah mat.' : 'Barazim.';
    return;
  }
  ui.status.textContent = 'Motori po mendon…';
  const quick = await engine.analyse(f, { depth: 10, multipv: 3 });
  if (g !== agen) return;
  showLines(quick);
  const deep = await engine.analyse(f, { depth: 16, multipv: 3, movetime: 3500 });
  if (g !== agen) return;
  showLines(deep);
  ui.status.textContent = `Thellësia ${deep.depth}.`;
}

/** A line's value for white, in pawns, or a mate count. */
function valueText(l: Line | undefined, fen: string): string {
  if (!l) return '…';
  const sign = sideToMove(fen) === 'w' ? 1 : -1;
  if (l.mate !== undefined) return `${l.mate * sign > 0 ? '' : '−'}M${Math.abs(l.mate)}`;
  const v = ((l.cp ?? 0) * sign) / 100;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
}

/** White's centipawns from a search (mate is +-1000). */
function whiteCp(a: Analysis, fen: string): number | null {
  const l = a.lines[0];
  if (!l) return null;
  const s = l.mate !== undefined ? (l.mate > 0 ? 1000 : -1000) : Math.max(-1000, Math.min(1000, l.cp ?? 0));
  return sideToMove(fen) === 'w' ? s : -s;
}

function sanLine(fen: string, pv: string[], n = 6): string {
  const c = new Chess(fen);
  const out: string[] = [];
  let num = Number(fen.split(' ')[5]);
  let first = true;
  for (const u of pv.slice(0, n)) {
    let m: Move;
    try {
      m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    } catch {
      break;
    }
    const prefix = m.color === 'w' ? `${num}. ` : first ? `${num}… ` : '';
    if (m.color === 'b') num++;
    out.push(prefix + sanHtml(m.san));
    first = false;
  }
  return out.join(' ');
}

function showLines(a: Analysis) {
  lastAnalysis = a;
  const f = fenAt();
  ui.lines.innerHTML = a.lines
    .filter((l) => l.pv[0])
    .map((l, i) => `<li><button type="button" class="line" data-line="${i}"><b class="tabular">${valueText(l, f)}</b><span>${sanLine(f, l.pv)}</span></button></li>`)
    .join('');
  showEval(a.lines[0], new Chess(f));
  const arrows: Arrow[] = a.lines
    .filter((l) => l.pv[0])
    .slice(0, 3)
    .map((l, i) => ({ from: l.pv[0].slice(0, 2), to: l.pv[0].slice(2, 4), tone: i === 0 ? 'pointer' : 'quiet' }));
  if (!editing) marks(arrows);
  if (!verdictHere()) headlineFromEval(a.lines[0]);
}

function showEval(l: Line | undefined | null, c: Chess) {
  const f = c.fen();
  let share = 0.5;
  if (c.isCheckmate()) {
    ui.evalText.textContent = c.turn() === 'w' ? '0–1' : '1–0';
    share = c.turn() === 'w' ? 0 : 1;
  } else if (c.isGameOver()) {
    ui.evalText.textContent = '½–½';
  } else if (l) {
    ui.evalText.textContent = valueText(l, f);
    const cp = l.mate !== undefined ? (l.mate > 0 ? 1000 : -1000) : (l.cp ?? 0);
    share = (winChance(sideToMove(f) === 'w' ? cp : -cp) + 1) / 2;
  }
  ui.evalBar.style.setProperty('--w', `${Math.round(share * 100)}%`);
  ui.turnLabel.textContent = c.turn() === 'w' ? 'Të bardhat' : 'Të zezat';
}

/** The coach card in plain analysis: who stands better, in words. */
function headlineFromEval(l: Line | undefined) {
  if (editing) return;
  const f = fenAt();
  ui.coach.dataset.state = 'note';
  ui.coach.dataset.grade = '';
  ui.reasons.innerHTML = '';
  if (!l) return;
  const sign = sideToMove(f) === 'w' ? 1 : -1;
  ui.glyph.textContent = valueText(l, f);
  if (l.mate !== undefined) {
    const winner = l.mate * sign > 0 ? 'Të bardhat' : 'Të zezat';
    ui.title.textContent = `${winner} japin mat në ${Math.abs(l.mate)}.`;
    return;
  }
  const cp = (l.cp ?? 0) * sign;
  const who = cp > 0 ? 'Të bardhat' : 'Të zezat';
  const a = Math.abs(cp);
  ui.title.textContent = a < 35 ? 'Pozicion i barabartë.' : a < 110 ? `${who} janë pak më mirë.` : a < 300 ? `${who} janë më mirë.` : `${who} po fitojnë.`;
}

// ------------------------------------------------------------------ the coach card, the strip and the sheet

/** In a reviewed game, the move on the board has the coach's verdict. */
function verdictHere(): Verdict | null {
  return review && at >= 0 ? (review.verdicts[at] ?? null) : null;
}

function render() {
  const v = verdictHere();
  if (v && !editing) {
    ui.coach.dataset.state = 'verdict';
    ui.coach.dataset.grade = v.grade;
    ui.glyph.innerHTML = `${sanHtml(v.san)}<span class="ann">${v.symbol}</span>`;
    ui.title.textContent = v.title;
    ui.reasons.innerHTML = v.reasons.map((r) => `<li>${sentenceHtml(r)}</li>`).join('');
    say(`${v.title}. ${v.reasons.map(sentenceText).join(' ')}`);
  } else if (!editing && at < 0 && !line.length) {
    ui.coach.dataset.state = 'intro';
    ui.coach.dataset.grade = '';
    ui.glyph.textContent = 'Analizo';
    ui.title.textContent = 'Luaj lëvizjet e të dy anëve, ose hap një lojë.';
    ui.reasons.innerHTML = '';
  }
  ui.prev.disabled = at < 0;
  ui.next.disabled = at >= line.length - 1;
  ui.best.hidden = editing;
  ui.prev.hidden = editing;
  ui.next.hidden = editing;
  ui.clear.hidden = !editing;
  ui.done.hidden = !editing;
  ui.editor.hidden = !editing;
  ui.lines.hidden = editing;
  renderStrip();
  renderSheet();
  const c = new Chess(fenAt());
  ui.turnLabel.textContent = c.turn() === 'w' ? 'Të bardhat' : 'Të zezat';
}

function renderStrip() {
  if (!line.length) {
    ui.strip.innerHTML = `<li class="strip__empty">${editing ? 'Vendos figurat në tabelë.' : 'Luaj një lëvizje, ose hap një lojë më poshtë.'}</li>`;
    return;
  }
  let num = Number(root.split(' ')[5]);
  const items: string[] = [];
  line.forEach((p, i) => {
    const white = sideToMove(i === 0 ? root : line[i - 1].fen) === 'w';
    if (white || i === 0) items.push(`<li class="strip__n tabular" aria-hidden="true">${num}${white ? '.' : '…'}</li>`);
    if (!white) num++;
    const v = review?.verdicts[i];
    items.push(`<li><button type="button" class="strip__mv" data-ply="${i}"${i === at ? ' aria-current="true"' : ''}>${sanHtml(p.san)}${v && v.symbol ? `<span class="ann" data-grade="${v.grade}">${v.symbol}</span>` : ''}</button></li>`);
    if (white && i === line.length - 1) num++;
  });
  ui.strip.innerHTML = items.join('');
  const b = ui.strip.querySelector<HTMLElement>('[aria-current]');
  if (b) ui.strip.scrollTo({ left: Math.max(0, b.offsetLeft - (ui.strip.clientWidth - b.offsetWidth) / 2), behavior: motionOn() ? 'smooth' : 'instant' });
}

function renderSheet() {
  if (!line.length) {
    ui.sheet.innerHTML = '<li class="sheet-empty">Lëvizjet do të shkruhen këtu.</li>';
    return;
  }
  const rows: string[] = [];
  let num = Number(root.split(' ')[5]);
  line.forEach((p, i) => {
    const white = sideToMove(i === 0 ? root : line[i - 1].fen) === 'w';
    const v = review?.verdicts[i];
    const cell = `<button type="button" class="mv mv--mine" data-ply="${i}"${i === at ? ' aria-current="true"' : ''}>${sanHtml(p.san)}${v && v.symbol ? `<span class="ann" data-grade="${v.grade}">${v.symbol}</span>` : ''}</button>`;
    if (white) rows.push(`<li><span class="mv-n tabular">${num}</span>${cell}`);
    else if (i === 0) rows.push(`<li><span class="mv-n tabular">${num}</span><span class="mv mv--gap">…</span>${cell}`);
    else rows[rows.length - 1] += cell;
    if (!white) num++;
  });
  ui.sheet.innerHTML = rows.map((r) => r + '</li>').join('');
}

const onPly = (e: Event) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-ply]');
  if (b) goTo(Number(b.dataset.ply));
};
ui.strip.addEventListener('click', onPly);
ui.sheet.addEventListener('click', onPly);
ui.prev.addEventListener('click', () => goTo(at - 1));
ui.next.addEventListener('click', () => goTo(at + 1));
ui.lines.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-line]');
  const l = b && lastAnalysis?.lines[Number(b.dataset.line)];
  if (l?.pv[0]) playUci(l.pv[0]);
});
ui.best.addEventListener('click', () => {
  const u = lastAnalysis?.fen === fenAt() ? lastAnalysis.lines[0]?.pv[0] : undefined;
  if (u) playUci(u);
  else say('Motori ende po mendon.');
});
function playUci(u: string) {
  const c = new Chess(fenAt());
  try {
    playMove(c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }));
  } catch {
    /* the line was for another position */
  }
}

// ------------------------------------------------------------------ setting up a position

function readMap(fen: string) {
  editMap = new Map();
  const c = new Chess(fen);
  for (const row of c.board()) for (const p of row) if (p) editMap.set(p.square, p.color + p.type);
}

function mapFen(turn: Side): string {
  const rows: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = '';
    let empty = 0;
    for (const f of 'abcdefgh') {
      const p = editMap.get(f + r);
      if (!p) {
        empty++;
        continue;
      }
      if (empty) row += empty;
      empty = 0;
      row += p[0] === 'w' ? p[1].toUpperCase() : p[1];
    }
    if (empty) row += empty;
    rows.push(row);
  }
  // castling only where king and rook still stand at home
  const has = (sq: string, p: string) => editMap.get(sq) === p;
  let castle = '';
  if (has('e1', 'wk') && has('h1', 'wr')) castle += 'K';
  if (has('e1', 'wk') && has('a1', 'wr')) castle += 'Q';
  if (has('e8', 'bk') && has('h8', 'br')) castle += 'k';
  if (has('e8', 'bk') && has('a8', 'br')) castle += 'q';
  return `${rows.join('/')} ${turn} ${castle || '-'} - 0 1`;
}

const editTurn = (): Side => (document.querySelector<HTMLInputElement>('input[name="edit-turn"]:checked')?.value === 'b' ? 'b' : 'w');

function startEditing() {
  editing = true;
  agen++;
  engine.cancelAll();
  readMap(fenAt());
  document.querySelector<HTMLInputElement>(`input[name="edit-turn"][value="${sideToMove(fenAt())}"]`)!.checked = true;
  ui.edit.setAttribute('aria-pressed', 'true');
  ui.coach.dataset.state = 'note';
  ui.coach.dataset.grade = '';
  ui.glyph.textContent = 'Rregullo pozicionin';
  ui.title.textContent = 'Zgjidh një figurë, pastaj prek fushat.';
  ui.reasons.innerHTML = '';
  ui.lines.innerHTML = '';
  board.setMarks({});
  setPen(pen);
  render();
}

function setPen(p: string) {
  pen = p;
  document.querySelectorAll<HTMLButtonElement>('[data-pen]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pen === p)));
}
document.querySelectorAll<HTMLButtonElement>('[data-pen]').forEach((b) => b.addEventListener('click', () => setPen(b.dataset.pen!)));

/** A tap while setting up: put the chosen piece there, or take away what stands there. */
function place(sq: Sq): boolean {
  if (!editing) return false;
  const cur = editMap.get(sq);
  if (pen === 'x' || cur === pen) editMap.delete(sq);
  else {
    // one king of each colour: a new king moves the old one
    if (pen[1] === 'k') for (const [s, p] of editMap) if (p === pen) editMap.delete(s);
    editMap.set(sq, pen);
  }
  board.setPosition(mapFen(editTurn()), false);
  return true;
}

function finishEditing() {
  const fen = mapFen(editTurn());
  const kings = [...editMap.values()];
  const problem =
    kings.filter((p) => p === 'wk').length !== 1 || kings.filter((p) => p === 'bk').length !== 1
      ? 'Duhet saktësisht një mbret i bardhë dhe një mbret i zi.'
      : [...editMap].some(([s, p]) => p[1] === 'p' && (s[1] === '1' || s[1] === '8'))
        ? 'Ushtarët nuk qëndrojnë dot në rreshtin e parë ose të tetë.'
        : (() => {
            try {
              const c = new Chess(fen);
              // the side that does not move must not be in check
              const flipped = new Chess(fen.replace(/ [wb] /, editTurn() === 'w' ? ' b ' : ' w '));
              return flipped.inCheck() && !c.inCheck() ? `Mbreti i ${editTurn() === 'w' ? 'zi' : 'bardhë'} është në shah, por radha nuk është e tij.` : '';
            } catch {
              return 'Ky pozicion nuk është i ligjshëm.';
            }
          })();
  if (problem) {
    ui.title.textContent = problem;
    say(problem);
    return;
  }
  editing = false;
  ui.edit.setAttribute('aria-pressed', 'false');
  root = fen;
  line = [];
  at = -1;
  review = null;
  renderReviewBox();
  board.setPosition(root, false);
  render();
  analyseNow();
}

ui.edit.addEventListener('click', () => (editing ? finishEditing() : startEditing()));
ui.done.addEventListener('click', finishEditing);
ui.clear.addEventListener('click', () => {
  editMap = new Map([
    ['e1', 'wk'],
    ['e8', 'bk'],
  ]);
  board.setPosition(mapFen(editTurn()), false);
});
document.querySelectorAll('input[name="edit-turn"]').forEach((i) => i.addEventListener('change', () => editing && board.setPosition(mapFen(editTurn()), false)));
$('[data-reset]').addEventListener('click', () => {
  editing = false;
  ui.edit.setAttribute('aria-pressed', 'false');
  loadLine(START, [], 'Pozicioni fillestar');
});

// ------------------------------------------------------------------ opening a game

function loadLine(start: string, moves: Ply[], label: string, toEnd = false) {
  root = start;
  line = moves;
  at = toEnd ? line.length - 1 : -1;
  review = null;
  renderReviewBox();
  board.setPosition(fenAt(), false);
  render();
  analyseNow();
  say(label);
}

/** A PGN (one game) or a FEN, as pasted. */
function parseText(text: string): { start: string; moves: Ply[]; white?: string; black?: string } | null {
  const t = text.trim();
  if (!t) return null;
  if (!t.includes('[') && !/\d\./.test(t) && t.split('/').length === 8) {
    try {
      return { start: new Chess(t).fen(), moves: [] };
    } catch {
      return null;
    }
  }
  const c = new Chess();
  try {
    c.loadPgn(t);
  } catch {
    return null;
  }
  const h = c.history({ verbose: true });
  if (!h.length) return null;
  const headers = c.getHeaders();
  return {
    start: h[0].before,
    moves: h.map((m) => ({ uci: m.from + m.to + (m.promotion ?? ''), san: m.san, fen: m.after })),
    white: headers.White,
    black: headers.Black,
  };
}

ui.paste.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = String(new FormData(ui.paste).get('text') ?? '');
  const g = parseText(text);
  if (!g) {
    ui.pasteNote.textContent = 'Nuk e lexova dot: ngjit PGN-në e plotë të një loje, ose një FEN.';
    return;
  }
  ui.pasteNote.textContent = g.moves.length ? `U hap: ${g.moves.length} lëvizje.` : 'Pozicioni u hap.';
  if (!g.moves.length) return loadLine(g.start, [], 'Pozicioni u hap.');
  void openGame(g.start, g.moves, g.white && g.black ? `${g.white} – ${g.black}` : 'Loja e ngjitur', null);
});

// ------------------------------------------------------------------ the learner's games from chess.com and Lichess

interface Found {
  pgn: string;
  white: string;
  black: string;
  me: Side;
  result: 'win' | 'loss' | 'draw';
  date: Date;
  speed: string;
}
let found: Found[] = [];

const dateText = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
const SPEED: Record<string, string> = { bullet: 'bullet', blitz: 'blitz', rapid: 'rapid', classical: 'klasike', daily: 'ditore', correspondence: 'ditore' };

async function fromChessCom(user: string): Promise<Found[]> {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(user.toLowerCase())}/games/archives`;
  const r = await fetch(base);
  if (r.status === 404) throw new Error('nouser');
  if (!r.ok) throw new Error('site');
  const { archives } = (await r.json()) as { archives: string[] };
  const out: Found[] = [];
  for (const url of [...archives].reverse().slice(0, 3)) {
    const m = (await (await fetch(url)).json()) as { games: { pgn?: string; rules: string; time_class: string; end_time: number; white: { username: string; result: string }; black: { username: string; result: string } }[] };
    for (const g of [...m.games].reverse()) {
      if (g.rules !== 'chess' || !g.pgn) continue;
      const me: Side = g.white.username.toLowerCase() === user.toLowerCase() ? 'w' : 'b';
      const mine = me === 'w' ? g.white.result : g.black.result;
      const result = mine === 'win' ? 'win' : ['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(mine) ? 'draw' : 'loss';
      out.push({ pgn: g.pgn, white: g.white.username, black: g.black.username, me, result, date: new Date(g.end_time * 1000), speed: SPEED[g.time_class] ?? g.time_class });
      if (out.length >= 15) return out;
    }
  }
  return out;
}

async function fromLichess(user: string): Promise<Found[]> {
  const r = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(user)}?max=15&pgnInJson=true&clocks=false&evals=false&opening=false`, { headers: { Accept: 'application/x-ndjson' } });
  if (r.status === 404) throw new Error('nouser');
  if (!r.ok) throw new Error('site');
  const text = await r.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { pgn: string; variant: string; speed: string; createdAt: number; winner?: 'white' | 'black'; players: { white: { user?: { name: string } }; black: { user?: { name: string } } } })
    .filter((g) => g.variant === 'standard' && g.pgn)
    .map((g) => {
      const white = g.players.white.user?.name ?? 'Anonim';
      const black = g.players.black.user?.name ?? 'Anonim';
      const me: Side = white.toLowerCase() === user.toLowerCase() ? 'w' : 'b';
      const result = !g.winner ? 'draw' : (g.winner === 'white') === (me === 'w') ? 'win' : 'loss';
      return { pgn: g.pgn, white, black, me, result, date: new Date(g.createdAt), speed: SPEED[g.speed] ?? g.speed } as Found;
    });
}

ui.fetch.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(ui.fetch);
  const user = String(data.get('user') ?? '').trim();
  const site = data.get('site') === 'lichess' ? 'lichess' : 'chesscom';
  if (!user) return;
  try {
    localStorage.setItem('shah.review.user', JSON.stringify({ user, site }));
  } catch {
    /* blocked storage: the name is asked again next time */
  }
  ui.fetchNote.textContent = 'Po marr lojërat…';
  ui.games.hidden = true;
  try {
    found = site === 'lichess' ? await fromLichess(user) : await fromChessCom(user);
  } catch (err) {
    const why = (err as Error).message;
    ui.fetchNote.textContent =
      why === 'nouser' ? `Nuk gjeta asnjë lojtar me emrin “${user}” në ${site === 'lichess' ? 'Lichess' : 'chess.com'}.` : !navigator.onLine ? 'Pa internet: lojërat merren vetëm kur je në linjë.' : `${site === 'lichess' ? 'Lichess' : 'Chess.com'} nuk u përgjigj. Provo përsëri pak më vonë, ose ngjit PGN-në.`;
    return;
  }
  if (!found.length) {
    ui.fetchNote.textContent = 'Asnjë lojë e zakonshme shahu në muajt e fundit.';
    return;
  }
  ui.fetchNote.textContent = 'Zgjidh një lojë për ta rishikuar.';
  const RES = { win: 'Fitore', loss: 'Humbje', draw: 'Barazim' };
  ui.games.innerHTML = found
    .map((g, i) => {
      const them = g.me === 'w' ? g.black : g.white;
      return `<li><button type="button" class="row game-row" data-game="${i}"><b>${g.me === 'w' ? 'Me të bardhat' : 'Me të zezat'} kundër ${them.replace(/[<>&]/g, '')}</b><span>${dateText(g.date)} · ${g.speed}</span><span class="res" data-r="${g.result}">${RES[g.result]}</span></button></li>`;
    })
    .join('');
  ui.games.hidden = false;
});

ui.games.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-game]');
  const g = b && found[Number(b.dataset.game)];
  if (!g) return;
  const p = parseText(g.pgn);
  if (!p || !p.moves.length) {
    ui.fetchNote.textContent = 'Kjo lojë nuk u lexua dot.';
    return;
  }
  void openGame(p.start, p.moves, `${g.white} – ${g.black}, ${dateText(g.date)}`, g.me);
  document.querySelector('.stage')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
});

// ------------------------------------------------------------------ the review

async function openGame(start: string, moves: Ply[], label: string, me: Side | null) {
  loadLine(start, moves, label);
  await runReview(me ?? 'w', label, me === null);
}

let rgen = 0;
async function runReview(me: Side, label: string, askSide: boolean) {
  const g = ++rgen;
  agen++;
  reviewing = true;
  engine.cancelAll();
  review = { me, verdicts: line.map(() => null), evals: [], done: false, label };
  document.querySelector<HTMLInputElement>(`input[name="me"][value="${me}"]`)!.checked = true;
  renderReviewBox();
  ui.reviewNote.textContent = askSide ? 'Zgjidh me cilën ngjyrë luajte, që gabimet e tua të bëhen ushtrime.' : '';
  const fens = [root, ...line.map((p) => p.fen)];
  const looks: Analysis[] = [];
  for (let k = 0; k < fens.length; k++) {
    ui.status.textContent = `Trajneri po e shikon lojën: ${k} nga ${fens.length - 1}`;
    ui.reviewTitle.textContent = `Rishikimi · ${Math.round((k / fens.length) * 100)}%`;
    const c = new Chess(fens[k]);
    looks[k] = c.isGameOver() ? { fen: fens[k], bestmove: null, depth: 0, lines: [] } : await engine.analyse(fens[k], { depth: 12, multipv: 2, movetime: 1500 });
    if (g !== rgen) return;
    review.evals[k] = c.isCheckmate() ? (c.turn() === 'w' ? -1000 : 1000) : c.isGameOver() ? 0 : whiteCp(looks[k], fens[k]);
    if (k > 0) {
      const i = k - 1;
      try {
        review.verdicts[i] = judge({ fen: fens[i], uci: line[i].uci, history: line.slice(0, i).map((p) => p.san), before: looks[i], after: looks[k] });
      } catch {
        review.verdicts[i] = null;
      }
      if (i === at) render();
      renderStrip();
      if (k % 4 === 0) renderGraph();
    }
  }
  reviewing = false;
  review.done = true;
  keepMistakes();
  ui.status.textContent = 'Rishikimi mbaroi.';
  renderReviewBox();
  render();
  analyseNow();
}

/** The learner's own mistakes in this game join the puzzles that come back. */
function keepMistakes() {
  if (!review?.done) return;
  review.verdicts.forEach((v, i) => {
    if (v && sideToMove(i === 0 ? root : line[i - 1].fen) === review!.me) addCard(v);
  });
}

document.querySelectorAll<HTMLInputElement>('input[name="me"]').forEach((i) =>
  i.addEventListener('change', () => {
    if (!review) return;
    review.me = i.value === 'b' ? 'b' : 'w';
    ui.reviewNote.textContent = '';
    keepMistakes();
    renderReviewBox();
  }),
);

function renderReviewBox() {
  ui.review.hidden = !review;
  if (!review) return;
  ui.reviewTitle.textContent = review.done ? `Rishikimi: ${review.label}` : ui.reviewTitle.textContent;
  const bySide = (s: Side) => review!.verdicts.filter((v, i): v is Verdict => !!v && sideToMove(i === 0 ? root : line[i - 1].fen) === s);
  const fmt = (s: Side) => {
    const vs = bySide(s);
    const acc = gameAccuracy(vs);
    const n = (g: string) => vs.filter((v) => v.grade === g).length;
    return `${acc === null ? '–' : `${Math.round(acc)}%`} · ${n('blunder')} ?? · ${n('mistake')} ? · ${n('inaccuracy')} ?!`;
  };
  const op = openingOf(line.map((p) => p.san));
  const rows: [string, string][] = [
    [`Të bardhat${review.me === 'w' ? ' (ti)' : ''}`, fmt('w')],
    [`Të zezat${review.me === 'b' ? ' (ti)' : ''}`, fmt('b')],
    ['Hapja', op ? op.name : 'E panjohur'],
    ['Lëvizje', String(Math.ceil(line.length / 2))],
  ];
  ui.reviewRows.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v.replace(/[<>&]/g, '')}</dd></div>`).join('');
  renderGraph();
}

/** The learner's move that cost the most winning chances. */
function turning(): number | null {
  if (!review) return null;
  let best: number | null = null;
  let drop = 10;
  review.verdicts.forEach((v, i) => {
    if (!v || sideToMove(i === 0 ? root : line[i - 1].fen) !== review!.me) return;
    const d = v.winBefore - v.winAfter;
    if (d > drop) {
      drop = d;
      best = i;
    }
  });
  return best;
}

function renderGraph() {
  if (!review) return;
  const n = review.evals.length;
  if (n < 2) {
    ui.reviewSvg.innerHTML = '';
    ui.reviewCap.textContent = 'Grafiku del sapo trajneri të ketë parë disa lëvizje.';
    ui.turning.hidden = true;
    return;
  }
  let last = 20;
  const share = review.evals.map((e) => {
    if (e != null) last = e;
    return (winChance(last) + 1) / 2;
  });
  const total = Math.max(1, line.length);
  const y = (v: number) => (196 - v * 192).toFixed(1);
  const path = share.map((v, i) => `${((i / total) * 1000).toFixed(1)} ${y(v)}`).join(' L');
  const marksSvg = review.verdicts
    .map((v, i) => (v && (v.grade === 'mistake' || v.grade === 'blunder') ? `<line class="review__mark" x1="${(((i + 1) / total) * 1000).toFixed(1)}" x2="${(((i + 1) / total) * 1000).toFixed(1)}" y1="0" y2="200"/>` : ''))
    .join('');
  ui.reviewSvg.innerHTML = `<rect class="review__bg" width="1000" height="200"/><path class="review__area" d="M0 200 L${path} L${(((n - 1) / total) * 1000).toFixed(1)} 200 Z"/><line class="review__mid" x1="0" x2="1000" y1="100" y2="100"/>${marksSvg}`;
  const t = turning();
  const v = t !== null ? review.verdicts[t] : null;
  ui.reviewCap.innerHTML = v
    ? sentenceHtml(`Momenti kyç për ty: lëvizja ${Math.floor(t! / 2) + 1}, [[${v.san}]]${v.symbol}. Shanset e tua ranë nga ${Math.round(v.winBefore)}% në ${Math.round(v.winAfter)}%. Vijat e kuqe janë gabimet.`)
    : review.done
      ? 'Asnjë lëvizje jotja nuk e ndryshoi lojën shumë. Pjesa e çelët tregon shanset e të bardhave.'
      : 'Trajneri po vazhdon…';
  ui.turning.hidden = t === null;
}
ui.turning.addEventListener('click', () => {
  const t = turning();
  if (t !== null) {
    goTo(t);
    document.querySelector('.stage')?.scrollIntoView({ behavior: motionOn() ? 'smooth' : 'auto' });
  }
});
ui.reviewSvg.addEventListener('click', (e) => {
  const r = ui.reviewSvg.getBoundingClientRect();
  goTo(Math.round(((e.clientX - r.left) / r.width) * line.length) - 1);
});

// ------------------------------------------------------------------ board and start

$('[data-flip]').addEventListener('click', () => {
  orientation = orientation === 'w' ? 'b' : 'w';
  board.setOrientation(orientation);
});
$('[data-angle]').addEventListener('click', () => {
  const n = board.cycleAngle?.();
  if (n) say(n);
});

onMotion((on) => board?.setMotion(on));
onTick((dt) => board?.tick(dt));
followBroadcast(ui.host, ui.coach, () => board);
keyboard(ui.host, () => board, () => orientation);

(async () => {
  board = await createBoard('3d', { host: ui.host, orientation, motion: motionOn, dests, onMove: (f, t) => void onMove(f, t), label: 'Tabela e analizës', keepTaken: false, onSquare: place });
  board.setPosition(root, false);
  try {
    const saved = JSON.parse(localStorage.getItem('shah.review.user') || 'null') as { user: string; site: string } | null;
    if (saved) {
      (ui.fetch.elements.namedItem('user') as HTMLInputElement).value = saved.user;
      ui.fetch.querySelector<HTMLInputElement>(`input[name="site"][value="${saved.site}"]`)!.checked = true;
    }
  } catch {
    /* nothing saved */
  }
  // the play page hands over its game ("Analizo lojën")
  let handed: string | null = null;
  try {
    handed = sessionStorage.getItem('shah.analyse');
    sessionStorage.removeItem('shah.analyse');
  } catch {
    /* nothing handed over */
  }
  const g = handed ? parseText(handed) : null;
  if (g) loadLine(g.start, g.moves, 'Loja jote u hap.', true);
  else render();
  if (!handed) analyseNow();
})();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__analyse = {
    state: () => ({ at, fen: fenAt(), line: line.map((p) => p.san), editing, reviewing, review: review && { me: review.me, done: review.done, verdicts: review.verdicts.map((v) => v && v.grade) }, lines: lastAnalysis?.lines.length ?? 0 }),
    move: (f: Sq, t: Sq) => onMove(f, t),
    place: (sq: Sq) => place(sq),
    pen: (p: string) => setPen(p),
  };
}
