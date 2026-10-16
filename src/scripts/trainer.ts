// The opening trainer: the app plays the other side's replies from the repertoire, the learner must find their
// own repertoire move each time. A wrong move is shown the right answer and taken back. Three clean runs in a row
// and a line counts as learnt; the weakest lines come first.

import { Chess, type Square } from 'chess.js';
import { repertoireOf } from '../data/repertoires.ts';
import { sentenceHtml, sentenceText } from '../lib/notation.ts';
import { openingOf } from '../lib/openings.ts';
import { load, update } from '../lib/store.ts';
import { createBoard, keepBoardStill, keyboard, type BoardView } from './board/index.ts';
import type { Side, Sq } from './board/types.ts';
import { gsap, motionOn, onMotion, onTick } from './shell.ts';
import { missSound, moveSound, winSound } from '../lib/sound.ts';
import { closePanels } from './panel.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const stageEl = $('[data-stage-box]');
const rep = repertoireOf(stageEl.dataset.rep!)!;
const side: Side = rep.side;
const LEARNT = 3;

const ui = {
  host: $('[data-board]'),
  status: $('[data-status]'),
  lineN: $('[data-line-n]'),
  learnt: $('[data-learnt]'),
  coach: $('[data-coach]'),
  glyph: $('[data-glyph]'),
  title: $('[data-title]'),
  reasons: $('[data-reasons]'),
  hint: $<HTMLButtonElement>('[data-hint]'),
  again: $<HTMLButtonElement>('[data-again]'),
  next: $<HTMLButtonElement>('[data-next]'),
  angle: $<HTMLButtonElement>('[data-angle]'),
  ticker: $('[data-ticker]'),
  rail: $('[data-rail]'),
  live: $('[data-live]'),
  lines: $('[data-lines]'),
};

// each line as UCI moves, read once
const LINES = rep.lines.map((l) => {
  const c = new Chess();
  const ucis = l.moves.split(' ').map((san) => {
    const m = c.move(san);
    return m.from + m.to + (m.promotion ?? '');
  });
  return { ...l, ucis, sans: l.moves.split(' ') };
});
const keyOf = (i: number) => `${rep.slug}:${i}`;

let board: BoardView;
let chess = new Chess();
let line = 0;
let ply = 0;
let errors = 0;
let busy = false;
let done = false;
let gen = 0;
let hintStep = 0;

const wait = (ms: number) => new Promise((r) => setTimeout(r, motionOn() ? ms : Math.min(ms, 150)));
const stats = () => load().reps;

function dests(sq: Sq): Sq[] {
  if (busy || done || chess.turn() !== side) return [];
  const p = chess.get(sq as Square);
  if (!p || p.color !== side) return [];
  return chess.moves({ square: sq as Square, verbose: true }).map((m) => m.to);
}

function marks(extra: { arrows?: { from: Sq; to: Sq }[]; focus?: Sq[] } = {}) {
  const h = chess.history({ verbose: true });
  const last = h.length ? ([h[h.length - 1].from, h[h.length - 1].to] as [Sq, Sq]) : null;
  board.setMarks({ last, arrows: extra.arrows ?? [], focus: extra.focus ?? [] });
}

function coach(state: string, glyph: string, title: string, lines: string[]) {
  ui.coach.dataset.state = state;
  ui.glyph.textContent = glyph;
  ui.title.textContent = title;
  ui.reasons.innerHTML = lines.map((l) => `<li>${sentenceHtml(l)}</li>`).join('');
  ui.live.textContent = `${glyph}. ${lines.map(sentenceText).join(' ')}`;
  if (motionOn()) {
    const parts = [ui.coach.querySelector('.lower__head'), ui.coach.querySelector('.lower__body')];
    gsap.fromTo(parts, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.3, stagger: 0.06, ease: 'power3.out', clearProps: 'clipPath' });
  }
}

/** The line to drill next: not learnt yet, fewest clean runs, then fewest tries. */
function pickLine(): number {
  const s = stats();
  const order = LINES.map((_, i) => ({ i, st: s[keyOf(i)] ?? { streak: 0, tries: 0 } }))
    .sort((a, b) => Number(a.st.streak >= LEARNT) - Number(b.st.streak >= LEARNT) || a.st.streak - b.st.streak || a.st.tries - b.st.tries);
  const low = order.filter((o) => o.st.streak === order[0].st.streak && o.st.tries === order[0].st.tries);
  return low[Math.floor(Math.random() * low.length)].i;
}

async function start(i: number) {
  const g = ++gen;
  line = i;
  chess = new Chess();
  ply = 0;
  errors = 0;
  done = false;
  hintStep = 0;
  busy = true;
  board.setOrientation(side);
  board.setInteractive(false);
  board.setPosition(chess.fen(), true);
  board.setMarks({});
  ui.lineN.textContent = `${i + 1} nga ${LINES.length}`;
  ui.again.hidden = true;
  ui.next.hidden = true;
  ui.hint.hidden = false;
  coach('intro', 'Luaj repertorin', rep.title, [side === 'w' ? 'Ti fillon. Luaj lëvizjet e repertorit tënd.' : 'Kundërshtari fillon. Përgjigju me lëvizjet e repertorit tënd.']);
  render();
  await advance(g);
}

/** Play the other side's moves until it is the learner's turn or the line ends. */
async function advance(g: number) {
  while (ply < LINES[line].ucis.length && chess.turn() !== side) {
    await wait(ply === 0 ? 600 : 450);
    if (g !== gen) return;
    const u = LINES[line].ucis[ply];
    moveSound(chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }).san);
    ply++;
    board.setPosition(chess.fen(), true);
    marks();
  }
  if (ply >= LINES[line].ucis.length) return finish();
  busy = false;
  hintStep = 0;
  board.setInteractive(true);
  const op = openingOf(chess.history());
  ui.status.textContent = 'Radha jote.';
  if (ply > 1) coach('intro', op?.name ?? rep.title, 'Radha jote', ['Cila është lëvizja e repertorit këtu?']);
}

async function onMove(from: Sq, to: Sq) {
  if (busy || done) return;
  const g = gen;
  const expected = LINES[line].ucis[ply];
  const uci = from + to;
  busy = true;
  board.setInteractive(false);
  let m;
  try {
    m = chess.move({ from, to, promotion: expected[4] || 'q' });
    moveSound(m.san);
  } catch {
    busy = false;
    board.setInteractive(true);
    board.setPosition(chess.fen(), true);
    return;
  }
  board.setPosition(chess.fen(), true);
  marks();
  if (uci !== expected.slice(0, 4)) {
    errors++;
    const right = LINES[line].sans[ply];
    missSound();
    coach('wrong', 'Jo kjo', 'Repertori yt luan ndryshe', [`[[${m.san}]] nuk është në repertor. Këtu luhet [[${right}]].`]);
    await wait(1000);
    if (g !== gen) return;
    chess.undo();
    board.setPosition(chess.fen(), true);
    marks({ arrows: [{ from: expected.slice(0, 2), to: expected.slice(2, 4) }] });
    busy = false;
    board.setInteractive(true);
    return;
  }
  ply++;
  coach('good', 'E saktë', openingOf(chess.history())?.name ?? rep.title, [`[[${m.san}]] është lëvizja e repertorit.`]);
  await advance(g);
}

function finish() {
  done = true;
  busy = false;
  board.setInteractive(false);
  const clean = errors === 0;
  update((p) => {
    const st = p.reps[keyOf(line)] ?? { streak: 0, tries: 0 };
    st.tries++;
    st.streak = clean ? st.streak + 1 : 0;
    p.reps[keyOf(line)] = st;
  });
  const st = stats()[keyOf(line)];
  const l = LINES[line];
  const tail = st.streak >= LEARNT ? 'Linja e mësuar.' : clean ? `Pa gabim: ${st.streak} nga ${LEARNT} herë rresht.` : 'Me gabime: numri rresht nis nga e para.';
  winSound();
  coach('solved', l.name, tail, [l.idea]);
  ui.status.textContent = 'Linja mbaroi.';
  ui.hint.hidden = true;
  ui.again.hidden = false;
  ui.next.hidden = false;
  render();
}

ui.hint.addEventListener('click', () => {
  if (busy || done) return;
  const u = LINES[line].ucis[ply];
  hintStep = Math.min(2, hintStep + 1);
  errors++;
  marks(hintStep === 1 ? { focus: [u.slice(0, 2)] } : { focus: [u.slice(0, 2)], arrows: [{ from: u.slice(0, 2), to: u.slice(2, 4) }] });
  coach('note', 'Ndihmë', LINES[line].name, [hintStep === 1 ? 'Lëviz figurën e shënuar.' : `Lëvizja e repertorit: [[${LINES[line].sans[ply]}]].`]);
});
ui.again.addEventListener('click', () => void start(line));
ui.next.addEventListener('click', () => void start(pickLine()));
ui.lines.addEventListener('click', (e) => {
  const b = (e.target as Element).closest<HTMLButtonElement>('[data-pick]');
  if (!b) return;
  void start(Number(b.dataset.pick));
  closePanels();
});

/** The count of learnt lines, the rail of lines and the list below the stage. */
function render() {
  const s = stats();
  const learnt = LINES.filter((_, i) => (s[keyOf(i)]?.streak ?? 0) >= LEARNT).length;
  ui.learnt.textContent = `${learnt} nga ${LINES.length}`;
  ui.rail.innerHTML = LINES.map((_, i) => {
    const st = s[keyOf(i)];
    const g = !st ? 'them' : st.streak >= LEARNT ? 'best' : st.streak > 0 ? 'pending' : 'mistake';
    return `<i data-g="${g}"${i === line ? ' data-now' : ''}></i>`;
  }).join('');
  ui.rail.style.setProperty('--slots', String(Math.max(24, LINES.length)));
  ui.rail.setAttribute('aria-label', `Linjat e repertorit: ${learnt} të mësuara nga ${LINES.length}`);
  LINES.forEach((_, i) => {
    const st = s[keyOf(i)];
    ui.lines.querySelector(`[data-state-of="${i}"]`)!.textContent = !st ? 'E paprovuar' : st.streak >= LEARNT ? 'E mësuar' : `${st.streak} nga ${LEARNT} rresht pa gabim`;
  });
  const items = [rep.title, `${learnt} nga ${LINES.length} linja të mësuara`, ...LINES.map((l) => `${l.name}: ${l.idea}`)];
  const html = items.map((t) => `<span>${t.replace(/[<>&]/g, '')}</span>`).join('');
  ui.ticker.innerHTML = html + html;
  ui.ticker.style.setProperty('--crawl', `${Math.max(50, items.join(' ').length * 0.28)}s`);
}

/** The board is always the 3D table (the flat one comes only where WebGL fails). */
async function mount() {
  board?.dispose();
  board = await createBoard('3d', { host: ui.host, orientation: side, motion: motionOn, dests, onMove: (f, t) => void onMove(f, t), label: 'Tabela e hapjes', keepTaken: false });
  board.setPosition(chess.fen(), false);
  marks();
  board.setInteractive(!busy && !done && chess.turn() === side);
  ui.angle.hidden = board.kind !== '3d';
}
ui.angle.addEventListener('click', () => {
  const n = board.cycleAngle?.();
  if (n) ui.live.textContent = n;
});

onMotion((on) => board?.setMotion(on));
onTick((dt) => board?.tick(dt));
keepBoardStill(ui.host, ui.coach, () => board);
keyboard(ui.host, () => board, () => side);

(async () => {
  await mount();
  await start(pickLine());
})();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__trainer = {
    state: () => ({ line, ply, errors, done, next: LINES[line].ucis[ply], fen: chess.fen() }),
    move: (f: Sq, t: Sq) => onMove(f, t),
  };
}
