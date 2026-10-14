// Online: a game with a friend, each on their own phone. The room on Shah's server (server/src/room.ts) is the
// referee and keeps the clocks; this page shows the state it sends, lets the learner move only their own pieces on
// their turn, and comes back by itself when the connection drops (the seat is kept in this browser, so a reload or
// a closed tab picks the game up where it stands). The coach stays out of a game between people: "Analizo lojën"
// opens it on the analysis board afterwards.

import { Chess, type Square } from 'chess.js';
import { sanHtml } from '../lib/notation.ts';
import { openingOf } from '../lib/openings.ts';
import { api, hasServer, ServerError, wsBase } from '../lib/server.ts';
import { missSound, moveSound, winSound } from '../lib/sound.ts';
import { createBoard, keepBoardStill, keyboard, mateFall, type BoardView } from './board/index.ts';
import type { Side, Sq } from './board/types.ts';
import { motionOn, onMotion, onTick } from './shell.ts';
import { takenIcons, writeTaken } from './celebrate.ts';

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const START = new Chess().fen();
const ui = {
  host: $('[data-board]'),
  status: $('[data-status]'),
  them: $('[data-them]'),
  you: $('[data-you]'),
  strip: $('[data-strip]'),
  coach: $('[data-coach]'),
  glyph: $('[data-glyph]'),
  title: $('[data-title]'),
  actions: $('[data-actions]'),
  promo: $('[data-promo]'),
  live: $('[data-live]'),
  sheet: $('[data-sheet]'),
  opening: $('[data-opening]'),
  setupDialog: $<HTMLDialogElement>('[data-setup-dialog]'),
  setup: $<HTMLFormElement>('[data-setup]'),
  codeDialog: $<HTMLDialogElement>('[data-code-dialog]'),
  codeForm: $<HTMLFormElement>('[data-code-form]'),
  codeNote: $('[data-code-note]'),
};
const act = (name: string) => ui.actions.querySelector<HTMLButtonElement>(`[data-act="${name}"]`)!;

// ------------------------------------------------------------------ state

type Status = 'waiting' | 'playing' | 'over';
interface RoomState {
  you: Side;
  code: string;
  round: number;
  status: Status;
  fen: string;
  moves: string[];
  sans: string[];
  result: { winner: Side | null; reason: string } | null;
  drawOffer: Side | null;
  rematch: Record<Side, boolean>;
  here: Record<Side, boolean>;
  gone: Record<Side, number | null>;
  clock: { key: string; base: number; inc: number; w: number; b: number; running: Side | null } | null;
  now: number;
}
interface Seat {
  code: string;
  token: string;
  side: Side;
}
interface Invite {
  code: string;
  status: Status;
  clock: string;
  seat: Side | null;
}

const SEAT_KEY = 'shah.online';
const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
/** the wait before the one left behind may take the game (the server checks it too) */
const ABANDON_MS = 60_000;

let seat: Seat | null = null;
let invite: Invite | null = null;
let state: RoomState | null = null;
/** the moves on the board: the room's, plus this player's move while the room has not yet answered */
let shown: string[] = [];
let shownFen = START;
let board: BoardView;
let orientation: Side = 'w';
let ws: WebSocket | null = null;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
/** when the clocks in `state` were read (performance.now), for the side whose clock runs */
let clockAt = 0;
/** when the latest state arrived (this phone's Date.now), to time the friend's absence without trusting the clocks agree */
let stateAt = 0;
let resignArmed: ReturnType<typeof setTimeout> | null = null;
let note = '';

const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');
const me = (): Side => state?.you ?? seat?.side ?? 'w';
const colour = (s: Side) => (s === 'w' ? 'të bardhat' : 'të zezat');
const say = (t: string) => (ui.live.textContent = t);
const CLOCK_NAMES: Record<string, string> = { none: 'pa orë', '10+0': '10 minuta', '5+3': '5 minuta + 3 sekonda', '3+2': '3 minuta + 2 sekonda' };

function readSeat(): Seat | null {
  try {
    const s = JSON.parse(localStorage.getItem(SEAT_KEY) || 'null') as Seat | null;
    return s && CODE_RE.test(s.code) && typeof s.token === 'string' ? s : null;
  } catch {
    return null;
  }
}
function writeSeat(s: Seat | null) {
  seat = s;
  try {
    if (s) localStorage.setItem(SEAT_KEY, JSON.stringify(s));
    else localStorage.removeItem(SEAT_KEY);
  } catch {
    /* the seat lasts for this page */
  }
}

// ------------------------------------------------------------------ talking to the room

const errorText = (e: unknown) =>
  e instanceof ServerError && e.status === 0 ? 'Pa internet. Provo përsëri kur të lidhesh.' : 'Serveri nuk u përgjigj. Provo përsëri pak më vonë.';

async function createRoom(side: string, clock: string) {
  leave(false);
  note = 'Po krijohet loja…';
  render();
  try {
    const out = await api<Seat>('/room', { body: { side, clock } });
    writeSeat(out);
    connect();
  } catch (e) {
    note = errorText(e);
    render();
  }
}

/** joins a room, or comes back to one (the token keeps the seat): 'gone' when the room is over or full */
async function joinRoom(code: string, token?: string): Promise<'ok' | 'gone' | 'offline'> {
  try {
    const out = await api<Seat>(`/room/${code}/join`, { body: token ? { token } : {} });
    writeSeat(out);
    connect();
    return 'ok';
  } catch (e) {
    if (e instanceof ServerError && (e.status === 404 || e.status === 409)) return 'gone';
    note = errorText(e);
    render();
    // coming back with a seat and no connection: try again in a moment
    if (token) retryTimer = setTimeout(() => void joinRoom(code, token), Math.min(10_000, 800 * 2 ** retry++));
    return 'offline';
  }
}

/** after a refused connection: does the seat still exist? */
async function seatAlive(s: Seat): Promise<boolean> {
  try {
    await api(`/room/${s.code}/join`, { body: { token: s.token } });
    return true;
  } catch (e) {
    return !(e instanceof ServerError && (e.status === 404 || e.status === 409));
  }
}

function connect() {
  if (!seat) return;
  clearTimeout(retryTimer);
  ws?.close();
  const s = seat;
  const socket = new WebSocket(`${wsBase}/room/${s.code}/ws?token=${s.token}`);
  ws = socket;
  let opened = false;
  socket.onopen = () => {
    opened = true;
    retry = 0;
    note = '';
    clearInterval(pingTimer);
    pingTimer = setInterval(() => socket.readyState === WebSocket.OPEN && socket.send('{"t":"ping"}'), 25_000);
  };
  socket.onmessage = (e) => {
    let m: { t?: string } & Partial<RoomState>;
    try {
      m = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (m.t === 'state') applyState(m as RoomState);
  };
  socket.onclose = async () => {
    if (ws !== socket) return;
    ws = null;
    clearInterval(pingTimer);
    if (!seat) return;
    if (!opened && !(await seatAlive(s))) {
      // refused at the door: the room has gone (a day after its last move)
      writeSeat(null);
      state = null;
      note = 'Kjo lojë nuk ekziston më. Krijo një të re.';
      resetBoard();
      render();
      return;
    }
    if (!seat || seat.token !== s.token) return;
    note = 'Lidhja ra. Po rilidhet…';
    render();
    retryTimer = setTimeout(connect, Math.min(10_000, 800 * 2 ** retry++));
  };
}

function send(m: object) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  else {
    note = 'Lidhja ra. Po rilidhet…';
    render();
  }
}

/** Leaves the room on this phone (the room itself stays until it expires). */
function leave(redraw = true) {
  writeSeat(null);
  invite = null;
  const old = ws;
  ws = null;
  old?.close();
  clearTimeout(retryTimer);
  clearInterval(pingTimer);
  state = null;
  if (redraw) {
    note = '';
    resetBoard();
    render();
  }
}

// ------------------------------------------------------------------ the room's state on the board

function resetBoard() {
  shown = [];
  shownFen = START;
  board?.setPosition(START, false);
}

function applyState(s: RoomState) {
  const prev = state;
  state = s;
  if (seat && (seat.side !== s.you || seat.code !== s.code)) writeSeat({ ...seat, side: s.you, code: s.code });
  if (!prev || prev.round !== s.round || prev.you !== s.you) {
    orientation = s.you;
    board.setOrientation(orientation);
    shown = [...s.moves];
    shownFen = s.fen;
    board.setPosition(s.fen, false);
  } else if (s.moves.length === shown.length + 1 && shown.every((u, i) => u === s.moves[i])) {
    // the friend's move: played on the board as it arrives
    shown = [...s.moves];
    shownFen = s.fen;
    board.setPosition(s.fen, true);
    moveSound(s.sans[s.sans.length - 1]);
    say(`Shoku: ${s.sans[s.sans.length - 1]}.`);
  } else if (s.moves.length !== shown.length || s.moves.some((u, i) => u !== shown[i])) {
    // the room refused a move, or the page missed some: the room's position is the one
    shown = [...s.moves];
    shownFen = s.fen;
    board.setPosition(s.fen, true);
  }
  clockAt = performance.now();
  stateAt = Date.now();
  if (prev?.status === 'playing' && s.status === 'over') {
    const won = s.result?.winner === s.you;
    if (won) winSound();
    else if (s.result?.winner) missSound();
  }
  if (prev?.status === 'waiting' && s.status === 'playing') say('Shoku hyri. Loja filloi.');
  if (s.status === 'over' && s.result?.reason === 'mate' && (prev?.status !== 'over' || prev.round !== s.round)) mateFall(() => board, s.fen, () => shownFen);
  render();
}

function dests(sq: Sq): Sq[] {
  if (!state || state.status !== 'playing' || shown.length !== state.moves.length) return [];
  const c = new Chess(shownFen);
  if (c.turn() !== me()) return [];
  const p = c.get(sq as Square);
  if (!p || p.color !== me()) return [];
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
  if (!state || state.status !== 'playing') return board.setPosition(shownFen, true);
  const c = new Chess(shownFen);
  let promotion: string | undefined;
  if (c.get(from as Square)?.type === 'p' && (to[1] === '8' || to[1] === '1')) {
    ui.promo.hidden = false;
    const k = await new Promise<string | null>((r) => (promoAsk = r));
    if (!k) return board.setPosition(shownFen, true);
    promotion = k;
  }
  let m;
  try {
    m = c.move({ from, to, promotion });
  } catch {
    return board.setPosition(shownFen, true);
  }
  const uci = m.from + m.to + (m.promotion ?? '');
  send({ t: 'move', uci, n: state.moves.length });
  shown = [...state.moves, uci];
  shownFen = c.fen();
  board.setPosition(shownFen, true);
  moveSound(m.san);
  render();
}

// ------------------------------------------------------------------ drawing

const fmt = (ms: number) => {
  const s = Math.max(0, ms) / 1000;
  if (s < 10) return s.toFixed(1);
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

function remaining(s: Side): number {
  const c = state?.clock;
  if (!c) return 0;
  return c.running === s ? c[s] - (performance.now() - clockAt) : c[s];
}

function renderClocks() {
  const c = state?.clock;
  for (const [row, s] of [
    [ui.you, me()],
    [ui.them, other(me())],
  ] as [HTMLElement, Side][]) {
    const el = row.querySelector<HTMLElement>('[data-clock]')!;
    el.hidden = !c;
    if (!c) continue;
    const ms = remaining(s);
    const t = fmt(ms);
    if (el.textContent !== t) el.textContent = t;
    el.toggleAttribute('data-low', ms < 20_000);
  }
}
onTick(() => {
  if (state?.clock?.running) renderClocks();
});

/** the captured pieces each side showed last time, so only a new one pops in */
const takenSeen = new Map<string, Record<string, number>>();
function renderPlayers() {
  const c = new Chess(shownFen);
  const full: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const val: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const have: Record<Side, Record<string, number>> = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of c.board()) for (const p of row) if (p && p.type !== 'k') have[p.color][p.type]++;
  const takenBy = (taker: Side) => {
    const victim = other(taker);
    let points = 0;
    const counts: Record<string, number> = {};
    for (const k of ['q', 'r', 'b', 'n', 'p']) {
      counts[k] = Math.max(0, full[k] - have[victim][k]);
      points += counts[k] * val[k];
    }
    return { html: takenIcons(takenSeen, taker, victim, counts), points };
  };
  const mine = takenBy(me());
  const theirs = takenBy(other(me()));
  const diff = mine.points - theirs.points;
  writeTaken(ui.you.querySelector('[data-taken]')!, mine.html + (diff > 0 ? `<span class="adv tabular">+${diff}</span>` : ''));
  writeTaken(ui.them.querySelector('[data-taken]')!, theirs.html + (diff < 0 ? `<span class="adv tabular">+${-diff}</span>` : ''));
  const away = state && state.status !== 'waiting' && !state.here[other(me())];
  ui.them.querySelector('[data-name]')!.textContent = !state || state.status === 'waiting' ? 'Shoku' : away ? 'Shoku · larg' : 'Shoku';
  const playing = state?.status === 'playing';
  ui.you.toggleAttribute('data-turn', !!playing && c.turn() === me());
  ui.them.toggleAttribute('data-turn', !!playing && c.turn() !== me());
  renderClocks();
}

function renderMoves() {
  const sans = state && shown.length === state.moves.length ? state.sans : sansOf(shown);
  if (!sans.length) {
    ui.strip.innerHTML = '<li class="strip__empty">Lëvizjet shfaqen këtu.</li>';
    ui.sheet.innerHTML = '<li class="sheet-empty">Lëvizjet do të shkruhen këtu.</li>';
    ui.opening.hidden = true;
    return;
  }
  const items: string[] = [];
  const rows: string[] = [];
  sans.forEach((san, i) => {
    const n = Math.floor(i / 2) + 1;
    const last = i === sans.length - 1;
    if (i % 2 === 0) items.push(`<li class="strip__n tabular" aria-hidden="true">${n}.</li>`);
    items.push(`<li><span class="strip__mv"${last ? ' aria-current="true"' : ''}>${sanHtml(san)}</span></li>`);
    const cell = `<span class="mv mv--mine"${last ? ' aria-current="true"' : ''}>${sanHtml(san)}</span>`;
    if (i % 2 === 0) rows.push(`<li><span class="mv-n tabular">${n}</span>${cell}`);
    else rows[rows.length - 1] += cell;
  });
  ui.strip.innerHTML = items.join('');
  const cur = ui.strip.querySelector<HTMLElement>('[aria-current]');
  if (cur) ui.strip.scrollTo({ left: Math.max(0, cur.offsetLeft - (ui.strip.clientWidth - cur.offsetWidth) / 2), behavior: motionOn() ? 'smooth' : 'instant' });
  ui.sheet.innerHTML = rows.map((r) => r + '</li>').join('');
  const op = openingOf(sans);
  ui.opening.hidden = !op;
  if (op) ui.opening.textContent = op.name;
}

function sansOf(ucis: string[]): string[] {
  const c = new Chess();
  return ucis.map((u) => c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined }).san);
}

function marks() {
  const last = shown.length ? ([shown[shown.length - 1].slice(0, 2), shown[shown.length - 1].slice(2, 4)] as [Sq, Sq]) : null;
  const c = new Chess(shownFen);
  let check: Sq | null = null;
  if (c.inCheck()) for (const row of c.board()) for (const p of row) if (p && p.type === 'k' && p.color === c.turn()) check = p.square;
  board.setMarks({ last, check });
}

const ENDINGS: Record<string, (won: boolean | null) => string> = {
  mate: (won) => (won ? 'Shah mat. Bukur!' : 'Shah mat.'),
  resign: (won) => (won ? 'Shoku u dorëzua.' : 'U dorëzove.'),
  time: (won) => (won === null ? 'Ra ora, por tjetri nuk ka figura për mat: barazim.' : won ? 'Shokut i ra ora.' : 'Të ra ora.'),
  agreed: () => 'Barazim me marrëveshje.',
  stalemate: () => 'Pat: mbreti nuk ka ku të lëvizë, por nuk është në shah.',
  material: () => 'Asnjëri nuk ka më figura për mat.',
  repetition: () => 'I njëjti pozicion u përsërit tri herë.',
  fifty: () => '50 lëvizje pa marrë figurë dhe pa lëvizur ushtar.',
  abandon: (won) => (won ? 'Shoku u largua nga loja.' : 'U largove nga loja.'),
};

function show(names: string[]) {
  ui.actions.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => (b.hidden = !names.includes(b.dataset.act!)));
}

let awayTimer: ReturnType<typeof setTimeout> | undefined;
function renderCard() {
  ui.coach.dataset.grade = '';
  clearTimeout(awayTimer);
  if (!hasServer) return;
  if (!state) {
    ui.coach.dataset.state = 'intro';
    if (seat) {
      ui.glyph.innerHTML = `<span class="room">${seat.code}</span>`;
      ui.title.textContent = note || 'Po lidhet me lojën…';
      show([]);
    } else if (invite) {
      ui.glyph.innerHTML = `<span class="room">${invite.code}</span>`;
      if (invite.status === 'waiting' && invite.seat) {
        ui.title.textContent = `Shoku të fton në një lojë: ti luan me ${colour(invite.seat)}, ${CLOCK_NAMES[invite.clock] ?? invite.clock}.`;
        show(['join']);
      } else {
        ui.title.textContent = 'Kjo lojë ka dy lojtarë tashmë. Krijo një tënden.';
        show(['create', 'code']);
      }
    } else {
      ui.glyph.textContent = 'Me një shok';
      ui.title.textContent = note || 'Secili në telefonin e vet. Krijo lojën dhe dërgoji lidhjen, ose hyr me kodin që të dha.';
      show(['create', 'code']);
    }
    ui.status.textContent = note || 'Gati për një lojë.';
    return;
  }

  const s = state;
  const mine = me();
  const c = new Chess(shownFen);
  if (s.status === 'waiting') {
    ui.coach.dataset.state = 'intro';
    ui.glyph.innerHTML = `<span class="room" aria-label="Kodi ${s.code.split('').join(' ')}">${s.code}</span>`;
    ui.title.textContent = note || `Dërgoji shokut lidhjen ose kodin. Ti luan me ${colour(mine)}; loja fillon sapo të hyjë.`;
    ui.status.textContent = 'Pret shokun…';
    show(['share', 'copy', 'leave']);
    return;
  }

  if (s.status === 'playing') {
    const myTurn = c.turn() === mine;
    ui.coach.dataset.state = 'note';
    ui.glyph.textContent = myTurn ? 'Radha jote' : 'Radha e shokut';
    const away = !s.here[other(mine)];
    const goneAt = s.gone[other(mine)];
    const goneFor = goneAt ? s.now - goneAt + (Date.now() - stateAt) : 0;
    let title: string;
    let acts: string[];
    if (s.drawOffer === other(mine)) {
      title = 'Shoku ofron barazim.';
      acts = ['accept', 'decline', 'resign'];
    } else if (away) {
      const wait = ABANDON_MS - goneFor;
      if (wait <= 0) {
        title = 'Shoku u largua. Mund ta marrësh fitoren, ose ta presësh.';
        acts = ['claim', 'resign'];
      } else {
        title = 'Shoku u shkëput. Po e presim të kthehet…';
        acts = ['resign'];
        awayTimer = setTimeout(renderCard, Math.min(wait + 200, ABANDON_MS));
      }
    } else if (s.drawOffer === mine) {
      title = 'Ofrove barazim. Pret përgjigjen e shokut.';
      acts = ['resign'];
    } else {
      const sans = s.sans;
      const lastSan = sans[sans.length - 1];
      const check = c.inCheck() ? ' Shah!' : '';
      title = !sans.length ? (mine === 'w' ? 'Ti fillon. Luaj lëvizjen e parë.' : 'Shoku fillon me të bardhat.') : myTurn ? `Shoku luajti ${lastSan}.${check}` : `Luajte ${lastSan}. Shoku po mendon.`;
      acts = ['draw', 'resign'];
    }
    ui.title.textContent = note || title;
    ui.status.textContent = note || `${myTurn ? 'Radha jote' : 'Radha e shokut'}${c.inCheck() ? ': shah!' : '.'}`;
    show(acts);
    act('draw').disabled = s.drawOffer !== null;
    return;
  }

  // over
  const won = s.result?.winner === null || !s.result ? null : s.result.winner === mine;
  ui.coach.dataset.state = 'end';
  ui.glyph.textContent = won === null ? 'Barazim' : won ? 'Fitove' : 'Humbe';
  let title = (ENDINGS[s.result?.reason ?? ''] ?? (() => 'Loja mbaroi.'))(won);
  const label = act('rematch').querySelector('[data-label]')!;
  act('rematch').disabled = false;
  if (s.rematch[mine]) {
    label.textContent = 'Pret shokun…';
    act('rematch').disabled = true;
  } else if (s.rematch[other(mine)]) {
    label.textContent = 'Prano revanshin';
    title += ' Shoku do revansh.';
  } else label.textContent = 'Revansh';
  if (!s.here[other(mine)] && !s.rematch[other(mine)]) title += ' Shoku nuk është më në lojë.';
  ui.title.textContent = note || title;
  ui.status.textContent = ui.glyph.textContent + '.';
  show(['rematch', 'analyse', 'leave']);
}

const baseTitle = document.title;
function render() {
  renderCard();
  renderPlayers();
  renderMoves();
  if (board) marks();
  const myTurn = state?.status === 'playing' && new Chess(shownFen).turn() === me();
  document.title = myTurn && document.hidden ? `● Radha jote · Shah` : baseTitle;
}
document.addEventListener('visibilitychange', () => {
  render();
  // back on the page with the connection gone: reconnect at once
  if (document.visibilityState === 'visible' && seat && !ws) connect();
});

// ------------------------------------------------------------------ actions

act('create').addEventListener('click', () => {
  ui.setupDialog.showModal();
  ui.setup.querySelector<HTMLElement>('.setup__title')?.focus();
});
$('[data-new]').addEventListener('click', () => {
  if (state?.status === 'playing' && !confirm('Po luan një lojë. Ta lësh dhe të krijosh një të re?')) return;
  ui.setupDialog.showModal();
});
$('[data-setup-close]').addEventListener('click', () => ui.setupDialog.close());
ui.setup.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(ui.setup);
  ui.setupDialog.close();
  void createRoom(String(data.get('side') ?? 'random'), String(data.get('clock') ?? 'none'));
});

act('code').addEventListener('click', () => {
  ui.codeNote.textContent = '';
  ui.codeDialog.showModal();
  ui.codeForm.querySelector<HTMLInputElement>('input')!.focus();
});
$('[data-code-close]').addEventListener('click', () => ui.codeDialog.close());
ui.codeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const field = ui.codeForm.querySelector<HTMLInputElement>('input')!;
  const code = field.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!CODE_RE.test(code)) {
    ui.codeNote.textContent = 'Kodi ka katër shkronja ose shifra, si K7QF.';
    return;
  }
  const btn = ui.codeForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  btn.disabled = true;
  leave(false);
  const r = await joinRoom(code);
  btn.disabled = false;
  if (r !== 'ok') {
    ui.codeNote.textContent = r === 'gone' ? 'Nuk ka lojë të lirë me këtë kod. Kontrolloje me shokun.' : 'Pa lidhje me serverin. Provo përsëri.';
    return;
  }
  field.value = '';
  ui.codeDialog.close();
});

act('join').addEventListener('click', async () => {
  if (!invite) return;
  const code = invite.code;
  act('join').disabled = true;
  const r = await joinRoom(code);
  act('join').disabled = false;
  if (r === 'offline') return;
  if (r === 'gone') {
    invite = { ...invite, status: 'playing', seat: null };
    render();
    return;
  }
  invite = null;
});

const link = () => `${location.origin}/online/?kod=${state?.code ?? seat?.code}`;
act('share').addEventListener('click', async () => {
  const code = state?.code ?? seat?.code;
  if (!code) return;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Shah', text: `Luaj shah me mua në Shah. Kodi: ${code}`, url: link() });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(link());
    say('Lidhja u kopjua.');
    ui.title.textContent = 'Lidhja u kopjua. Dërgoja shokut.';
  } catch {
    ui.title.textContent = `Lidhja: ${link()}`;
  }
});
act('copy').addEventListener('click', async () => {
  const code = state?.code ?? seat?.code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    ui.title.textContent = `Kodi ${code} u kopjua.`;
  } catch {
    ui.title.textContent = `Kodi: ${code}`;
  }
});

act('draw').addEventListener('click', () => send({ t: 'draw' }));
act('accept').addEventListener('click', () => send({ t: 'draw' }));
act('decline').addEventListener('click', () => send({ t: 'decline' }));
act('claim').addEventListener('click', () => send({ t: 'claim' }));
act('rematch').addEventListener('click', () => send({ t: 'rematch' }));
act('leave').addEventListener('click', () => leave());
act('resign').addEventListener('click', () => {
  const label = act('resign').querySelector('[data-label]')!;
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
  send({ t: 'resign' });
});

const analyse = () => {
  if (!state?.sans.length) return say('Ende pa lëvizje për të analizuar.');
  const c = new Chess();
  for (const san of state.sans) c.move(san);
  c.setHeader('White', state.you === 'w' ? 'Ti' : 'Shoku');
  c.setHeader('Black', state.you === 'b' ? 'Ti' : 'Shoku');
  try {
    sessionStorage.setItem('shah.analyse', c.pgn());
  } catch {
    /* blocked storage: the board opens empty */
  }
  location.href = '/analizo/';
};
act('analyse').addEventListener('click', analyse);
$('[data-analyse]').addEventListener('click', analyse);

$('[data-flip]').addEventListener('click', () => {
  orientation = other(orientation);
  board.setOrientation(orientation);
});
$('[data-angle]').addEventListener('click', () => {
  const n = board.cycleAngle?.();
  if (n) say(n);
});

// ------------------------------------------------------------------ start

onMotion((on) => board?.setMotion(on));
onTick((dt) => board?.tick(dt));
keepBoardStill(ui.host, ui.coach, () => board);
keyboard(ui.host, () => board, () => orientation);

(async () => {
  board = await createBoard('3d', { host: ui.host, orientation, motion: motionOn, dests, onMove: (f, t) => void onMove(f, t), label: 'Tabela e lojës online', keepTaken: false });
  board.setPosition(START, false);
  render();
  if (!hasServer) return;
  const params = new URLSearchParams(location.search);
  const saved = readSeat();
  const kod = (params.get('kod') ?? '').toUpperCase();
  if (params.has('krijo')) {
    // from the play page's new-game sheet
    history.replaceState(null, '', '/online/');
    return createRoom(params.get('ana') ?? 'random', params.get('ora') ?? 'none');
  }
  if (CODE_RE.test(kod) && saved?.code !== kod) {
    history.replaceState(null, '', '/online/');
    try {
      invite = await api<Invite>(`/room/${kod}`);
    } catch (e) {
      note = e instanceof ServerError && e.status === 404 ? `Nuk ka lojë me kodin ${kod}. Ndoshta ka mbaruar.` : errorText(e);
    }
    return render();
  }
  if (CODE_RE.test(kod)) history.replaceState(null, '', '/online/');
  if (saved) {
    seat = saved;
    render();
    const r = await joinRoom(saved.code, saved.token);
    if (r === 'gone') {
      writeSeat(null);
      note = 'Loja e fundit nuk ekziston më. Krijo një të re.';
      render();
    }
  }
})();

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__online = {
    state: () => ({ seat, invite, state, shown: [...shown], note }),
    move: (f: Sq, t: Sq) => onMove(f, t),
    drop: () => ws?.close(),
  };
}
