// A lesson as a broadcast segment: one step at a time, the board shows the idea, a task waits for the move.

import { Chess, type Square } from 'chess.js';
import { lessonOf, type Step } from '../data/lessons.ts';
import { icon } from '../lib/icons.ts';
import { sentenceHtml } from '../lib/notation.ts';
import { update } from '../lib/store.ts';
import { createBoard, followBroadcast, keyboard, type BoardView } from './board/index.ts';
import type { Side, Sq } from './board/types.ts';
import { gsap, motionOn, onMotion, onTick } from './shell.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const stageEl = $('[data-stage-box]');
const lesson = lessonOf(stageEl.dataset.lesson!)!;
const nextHref = stageEl.dataset.nextHref!;

const ui = {
  host: $('[data-board]'),
  status: $('[data-status]'),
  coach: $('[data-coach]'),
  glyph: $('[data-glyph]'),
  reasons: $('[data-reasons]'),
  task: $('[data-task]'),
  prev: $<HTMLButtonElement>('[data-prev]'),
  next: $<HTMLButtonElement>('[data-next]'),
  nextLabel: $('[data-next-label]'),
  hint: $<HTMLButtonElement>('[data-hint]'),
  again: $<HTMLButtonElement>('[data-again]'),
  angle: $<HTMLButtonElement>('[data-angle]'),
  view: $<HTMLButtonElement>('[data-view]'),
  promo: $('[data-promo]'),
  ticker: $('[data-ticker]'),
  rail: $('[data-rail]'),
  live: $('[data-live]'),
};

let board: BoardView;
let index = 0;
let chess = new Chess();
let ply = 0; // position in the step's task moves
let side: Side = 'w';
let solved = false;
let busy = false;
let hintStep = 0;
let gen = 0;
let kind: '3d' | '2d' = '2d';

const step = (): Step => lesson.steps[index];
const wait = (ms: number) => new Promise((r) => setTimeout(r, motionOn() ? ms : Math.min(ms, 120)));
const toMove = (u: string) => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });

function dests(sq: Sq): Sq[] {
  const t = step().task;
  if (!t || solved || busy || chess.turn() !== side) return [];
  const p = chess.get(sq as Square);
  if (!p || p.color !== side) return [];
  return chess.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
}

function marks(extra: { arrows?: { from: Sq; to: Sq }[]; focus?: Sq[] } = {}) {
  const h = chess.history({ verbose: true });
  const last = h.length ? ([h[h.length - 1].from, h[h.length - 1].to] as [Sq, Sq]) : null;
  let check: Sq | null = null;
  if (chess.inCheck()) for (const row of chess.board()) for (const p of row) if (p && p.type === 'k' && p.color === chess.turn()) check = p.square;
  board.setMarks({ last, check, arrows: extra.arrows ?? [], focus: extra.focus ?? [] });
}

function wipe() {
  if (!motionOn()) return;
  const parts = [ui.coach.querySelector('.lower__tag'), ui.coach.querySelector('.lower__head'), ui.coach.querySelector('.lower__body')];
  gsap.fromTo(parts, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.32, stagger: 0.06, ease: 'power3.out', clearProps: 'clipPath' });
}

async function show(i: number) {
  const g = ++gen;
  index = i;
  const s = step();
  chess = new Chess(s.fen);
  ply = 0;
  solved = !s.task;
  busy = !!s.setup;
  hintStep = 0;
  side = s.side ?? (chess.turn() === 'w' ? (s.setup ? 'b' : 'w') : s.setup ? 'w' : 'b');
  board.setOrientation(side);
  board.setPosition(s.fen, false);
  board.setInteractive(false);
  marks({ arrows: s.arrows, focus: s.focus });
  ui.glyph.textContent = s.title;
  ui.reasons.innerHTML = `<li>${sentenceHtml(s.text)}</li>`;
  ui.task.hidden = !s.task;
  ui.task.textContent = s.task ? `Radha jote: ${side === 'w' ? 'të bardhat' : 'të zezat'}.` : '';
  ui.status.textContent = `Hapi ${i + 1} nga ${lesson.steps.length}`;
  ui.prev.disabled = i === 0;
  ui.nextLabel.textContent = i === lesson.steps.length - 1 ? 'Përfundo' : 'Para';
  ui.hint.hidden = !s.task;
  ui.again.hidden = true;
  ui.live.textContent = `${s.title}. ${s.text}`;
  rail();
  wipe();
  if (s.setup) {
    await wait(700);
    if (g !== gen) return;
    chess.move(toMove(s.setup));
    board.setPosition(chess.fen(), true);
    marks({ arrows: s.arrows, focus: s.focus });
    busy = false;
  }
  board.setInteractive(!!s.task);
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
  const t = step().task;
  if (!t || solved || busy) return;
  const g = gen;
  let promotion: string | undefined;
  const piece = chess.get(from as Square);
  if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
    ui.promo.hidden = false;
    const k = await new Promise<string | null>((r) => (promoAsk = r));
    if (!k) return board.setPosition(chess.fen(), true);
    promotion = k;
  }
  const uci = from + to + (promotion ?? '');
  const expected = t.moves[ply];
  const accepted = [expected, ...(ply === 0 ? (t.also ?? []) : [])];
  const test = new Chess(chess.fen());
  let mates = false;
  try {
    test.move({ from, to, promotion });
    mates = test.isCheckmate();
  } catch {
    return board.setPosition(chess.fen(), true);
  }
  const right = accepted.some((a) => a === uci || (!a[4] && a.slice(0, 4) === uci.slice(0, 4))) || (mates && ply === t.moves.length - 1);
  busy = true;
  board.setInteractive(false);
  const m = chess.move({ from, to, promotion });
  board.setPosition(chess.fen(), true);
  marks();
  if (!right) {
    ui.task.innerHTML = `${sentenceHtml(`[[${m.san}]] nuk është përgjigjja. Provo përsëri.`)}`;
    ui.live.textContent = 'Jo kjo. Provo përsëri.';
    await wait(900);
    if (g !== gen) return;
    chess.undo();
    board.setPosition(chess.fen(), true);
    marks();
    busy = false;
    board.setInteractive(true);
    return;
  }
  ply++;
  // a different first move that is also right ends the task there (its line is not the scripted one)
  if (ply >= t.moves.length || uci !== expected) return done(t.done);
  await wait(550);
  if (g !== gen) return;
  chess.move(toMove(t.moves[ply]));
  ply++;
  board.setPosition(chess.fen(), true);
  marks();
  if (ply >= t.moves.length) return done(t.done);
  ui.task.textContent = 'Mirë. Vazhdo.';
  busy = false;
  board.setInteractive(true);
}

function done(text: string) {
  solved = true;
  busy = false;
  ui.task.hidden = false;
  ui.task.innerHTML = `${icon('check')} ${sentenceHtml(text)}`;
  ui.live.textContent = `Saktë. ${text}`;
  ui.hint.hidden = true;
  ui.again.hidden = false;
  rail();
}

ui.hint.addEventListener('click', () => {
  const t = step().task;
  if (!t || solved || busy) return;
  hintStep = Math.min(2, hintStep + 1);
  const u = t.moves[ply];
  marks(hintStep === 1 ? { focus: [u.slice(0, 2)] } : { focus: [u.slice(0, 2)], arrows: [{ from: u.slice(0, 2), to: u.slice(2, 4) }] });
  ui.task.textContent = hintStep === 1 ? 'Lëviz figurën e shënuar.' : 'Kjo është lëvizja. Luaje në tabelë.';
});
ui.again.addEventListener('click', () => void show(index));
ui.prev.addEventListener('click', () => index > 0 && void show(index - 1));
ui.next.addEventListener('click', () => {
  if (index < lesson.steps.length - 1) return void show(index + 1);
  update((p) => {
    if (!p.lessons.includes(lesson.slug)) p.lessons.push(lesson.slug);
  });
  location.href = nextHref;
});

function rail() {
  ui.rail.innerHTML = lesson.steps.map((_, i) => `<i data-g="${i < index ? 'good' : i === index ? (solved ? 'good' : 'pending') : 'them'}"${i === index ? ' data-now' : ''}></i>`).join('');
  const items = [lesson.title, lesson.lede, ...lesson.steps.map((s, i) => `Hapi ${i + 1}: ${s.title}`)];
  const html = items.map((t) => `<span>${t.replace(/[<>&]/g, '')}</span>`).join('');
  ui.ticker.innerHTML = html + html;
  ui.ticker.style.setProperty('--crawl', `${Math.max(36, items.join(' ').length * 0.3)}s`);
}

async function mount(k: '3d' | '2d') {
  board?.dispose();
  kind = k;
  board = await createBoard(k, { host: ui.host, orientation: side, motion: motionOn, dests, onMove: (f, t) => void onMove(f, t), label: 'Tabela e mësimit' });
  board.setPosition(chess.fen(), false);
  marks(solved ? {} : { arrows: step()?.arrows, focus: step()?.focus });
  board.setInteractive(!!step()?.task && !solved && !busy);
  ui.angle.hidden = board.kind !== '3d';
  ui.view.querySelector('[data-label]')!.textContent = board.kind === '3d' ? 'Pamje e sheshtë' : 'Pamje 3D';
  ui.view.querySelector('.tool__icon')!.innerHTML = board.kind === '3d' ? icon('square') : icon('cube');
}
ui.view.addEventListener('click', () => void mount(kind === '3d' ? '2d' : '3d'));
ui.angle.addEventListener('click', () => {
  const n = board.cycleAngle?.();
  if (n) ui.live.textContent = n;
});

onMotion((on) => board?.setMotion(on));
onTick((dt) => board?.tick(dt));
followBroadcast(ui.host, ui.coach, () => board);
keyboard(ui.host, () => board, () => side);

(async () => {
  await mount('2d');
  await show(0);
})();
