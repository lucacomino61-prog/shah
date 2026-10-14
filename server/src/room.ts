// One game between two friends, found by a four-letter code. The room is the referee: it checks every move with
// chess.js, keeps the clocks (they start after Black's first move, as on Lichess), ends the game on mate, a draw,
// a resignation, an agreed draw or a fallen flag, and sends both players the whole state after every change, so a
// phone that drops out picks the game up again where it stands. Sockets hibernate between moves.

import { DurableObject } from 'cloudflare:workers';
import { Chess } from 'chess.js';

type Side = 'w' | 'b';
const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;
export const newCode = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => ALPHABET[b % ALPHABET.length]).join('');
const newToken = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');

const DAY = 24 * 3600 * 1000;
/** a player who has been gone this long loses if the other asks for the win */
const ABANDON_MS = 60 * 1000;
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

interface Clock {
  base: number;
  inc: number;
  w: number;
  b: number;
  /** when the side to move started thinking; null while the clocks stand still */
  at: number | null;
}
interface Game {
  code: string;
  round: number;
  seats: Record<Side, string | null>;
  clockKey: string;
  clock: Clock | null;
  moves: string[];
  sans: string[];
  fen: string;
  status: 'waiting' | 'playing' | 'over';
  result: { winner: Side | null; reason: string } | null;
  drawOffer: Side | null;
  rematch: Record<Side, boolean>;
  /** when each player's last connection closed, null while connected */
  left: Record<Side, number | null>;
  touched: number;
}

export type Joined = { code: string; token: string; side: Side } | { error: 'missing' | 'full' | 'taken' | 'bad' };

export class Room extends DurableObject<Env> {
  private game: Game | null | undefined;
  private board: { key: string; c: Chess } | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // a ping is answered without waking the room
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  private clocks(): Record<string, [number, number] | null> {
    const c: Record<string, [number, number] | null> = { none: null, '10+0': [600_000, 0], '5+3': [300_000, 3_000], '3+2': [180_000, 2_000] };
    if (this.env.TEST_CLOCKS === '1') c['0.1+0'] = [6_000, 0];
    return c;
  }

  private async load(): Promise<Game | null> {
    if (this.game === undefined) this.game = (await this.ctx.storage.get<Game>('game')) ?? null;
    return this.game;
  }

  private async store(g: Game) {
    g.touched = Date.now();
    this.game = g;
    await this.ctx.storage.put('game', g);
    await this.schedule(g);
  }

  private async schedule(g: Game) {
    // the next thing the room must do by itself: a flag falling, or the room closing a day after it went quiet
    const times = [g.touched + DAY];
    if (g.status === 'playing' && g.clock?.at != null) times.push(g.clock.at + g.clock[this.turn(g)] + 25);
    await this.ctx.storage.setAlarm(Math.min(...times));
  }

  private turn = (g: Game): Side => g.fen.split(' ')[1] as Side;
  private sideOf = (g: Game, token: unknown): Side | null => (typeof token !== 'string' || !token ? null : g.seats.w === token ? 'w' : g.seats.b === token ? 'b' : null);

  /** the game's position with its history (threefold repetition needs it) */
  private chess(g: Game): Chess {
    const key = `${g.round}:${g.moves.length}`;
    if (this.board?.key === key) return this.board.c;
    const c = new Chess();
    for (const u of g.moves) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    this.board = { key, c };
    return c;
  }

  private remaining(g: Game, s: Side, now = Date.now()) {
    if (!g.clock) return 0;
    return g.clock.at !== null && this.turn(g) === s ? Math.max(0, g.clock[s] - (now - g.clock.at)) : g.clock[s];
  }

  async create(code: string, side: string, clockKey: string): Promise<Joined> {
    const g = await this.load();
    if (g && Date.now() - g.touched < DAY) return { error: 'taken' };
    const clocks = this.clocks();
    if (!(clockKey in clocks) || !['w', 'b', 'random'].includes(side)) return { error: 'bad' };
    const s: Side = side === 'random' ? (crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? 'w' : 'b') : (side as Side);
    const token = newToken();
    const c = clocks[clockKey];
    await this.store({
      code,
      round: 1,
      seats: { w: s === 'w' ? token : null, b: s === 'b' ? token : null },
      clockKey,
      clock: c ? { base: c[0], inc: c[1], w: c[0], b: c[0], at: null } : null,
      moves: [],
      sans: [],
      fen: START,
      status: 'waiting',
      result: null,
      drawOffer: null,
      rematch: { w: false, b: false },
      left: { w: null, b: null },
      touched: 0,
    });
    return { code, token, side: s };
  }

  /** what a friend opening the link sees before joining */
  async info() {
    const g = await this.load();
    if (!g) return null;
    return { code: g.code, status: g.status, clock: g.clockKey, seat: g.status === 'waiting' ? (g.seats.w ? 'b' : 'w') : null };
  }

  async join(token: string | null): Promise<Joined> {
    const g = await this.load();
    if (!g) return { error: 'missing' };
    const mine = this.sideOf(g, token);
    if (mine) return { code: g.code, token: token!, side: mine };
    if (g.status !== 'waiting') return { error: 'full' };
    const side: Side = g.seats.w ? 'b' : 'w';
    const t = newToken();
    g.seats[side] = t;
    g.status = 'playing';
    await this.store(g);
    this.broadcast(g);
    return { code: g.code, token: t, side };
  }

  async fetch(req: Request): Promise<Response> {
    const g = await this.load();
    const token = new URL(req.url).searchParams.get('token');
    const side = g && this.sideOf(g, token);
    if (!g || !side) return new Response('no seat', { status: 403 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ token });
    g.left[side] = null;
    await this.store(g);
    this.broadcast(g);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  private present(g: Game, s: Side, except?: WebSocket) {
    return this.ctx.getWebSockets().some((ws) => ws !== except && ws.readyState === 1 && this.sideOf(g, (ws.deserializeAttachment() as { token?: string })?.token) === s);
  }

  private view(g: Game, you: Side, except?: WebSocket) {
    const now = Date.now();
    return {
      t: 'state',
      you,
      code: g.code,
      round: g.round,
      status: g.status,
      fen: g.fen,
      moves: g.moves,
      sans: g.sans,
      result: g.result,
      drawOffer: g.drawOffer,
      rematch: g.rematch,
      here: { w: this.present(g, 'w', except), b: this.present(g, 'b', except) },
      gone: g.left,
      clock: g.clock
        ? { key: g.clockKey, base: g.clock.base, inc: g.clock.inc, w: this.remaining(g, 'w', now), b: this.remaining(g, 'b', now), running: g.status === 'playing' && g.clock.at !== null ? this.turn(g) : null }
        : null,
      now,
    };
  }

  private broadcast(g: Game, except?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const side = this.sideOf(g, (ws.deserializeAttachment() as { token?: string })?.token);
      if (!side) continue;
      try {
        ws.send(JSON.stringify(this.view(g, side, except)));
      } catch {
        /* a socket on its way out */
      }
    }
  }

  /** the winner on time, unless they have nothing left to mate with */
  private onTime(g: Game, winner: Side): Side | null {
    const c = this.chess(g);
    let minors = 0;
    for (const row of c.board())
      for (const p of row) {
        if (!p || p.color !== winner || p.type === 'k') continue;
        if (p.type === 'n' || p.type === 'b') minors++;
        else return winner;
      }
    return minors >= 2 ? winner : null;
  }

  private finish(g: Game, winner: Side | null, reason: string) {
    const now = Date.now();
    if (g.clock && g.clock.at !== null) {
      const s = this.turn(g);
      g.clock[s] = Math.max(0, g.clock[s] - (now - g.clock.at));
      g.clock.at = null;
    }
    g.status = 'over';
    g.result = { winner, reason };
    g.drawOffer = null;
    g.rematch = { w: false, b: false };
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string' || raw.length > 300) return;
    let msg: { t?: string; uci?: string; n?: number };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const g = await this.load();
    if (!g) return ws.close(4004, 'gone');
    const side = this.sideOf(g, (ws.deserializeAttachment() as { token?: string })?.token);
    if (!side) return ws.close(4003, 'no seat');
    const resend = () => ws.send(JSON.stringify(this.view(g, side)));
    const now = Date.now();

    switch (msg.t) {
      case 'move': {
        if (g.status !== 'playing' || typeof msg.uci !== 'string' || !UCI_RE.test(msg.uci) || msg.n !== g.moves.length || this.turn(g) !== side) return resend();
        const c = this.chess(g);
        let m;
        try {
          m = c.move({ from: msg.uci.slice(0, 2), to: msg.uci.slice(2, 4), promotion: msg.uci[4] || undefined });
        } catch {
          return resend();
        }
        if (g.clock && g.clock.at !== null) {
          g.clock[side] -= now - g.clock.at;
          if (g.clock[side] <= 0) {
            // the move came after the flag fell
            c.undo();
            g.clock[side] = 0;
            g.clock.at = null;
            this.finish(g, this.onTime(g, other(side)), 'time');
            break;
          }
          g.clock[side] += g.clock.inc;
        }
        g.moves.push(m.from + m.to + (m.promotion ?? ''));
        g.sans.push(m.san);
        g.fen = c.fen();
        this.board = { key: `${g.round}:${g.moves.length}`, c };
        g.drawOffer = null;
        if (g.clock) g.clock.at = g.moves.length >= 2 ? now : null;
        if (c.isCheckmate()) this.finish(g, side, 'mate');
        else if (c.isStalemate()) this.finish(g, null, 'stalemate');
        else if (c.isInsufficientMaterial()) this.finish(g, null, 'material');
        else if (c.isThreefoldRepetition()) this.finish(g, null, 'repetition');
        else if (c.isDrawByFiftyMoves()) this.finish(g, null, 'fifty');
        break;
      }
      case 'resign':
        if (g.status !== 'playing') return resend();
        this.finish(g, other(side), 'resign');
        break;
      case 'draw':
        if (g.status !== 'playing') return resend();
        if (g.drawOffer === other(side)) this.finish(g, null, 'agreed');
        else g.drawOffer = side;
        break;
      case 'decline':
        if (g.drawOffer !== other(side)) return resend();
        g.drawOffer = null;
        break;
      case 'claim': {
        const gone = g.left[other(side)];
        if (g.status !== 'playing' || this.present(g, other(side)) || gone === null || now - gone < (this.env.TEST_CLOCKS === '1' ? 3_000 : ABANDON_MS)) return resend();
        this.finish(g, side, 'abandon');
        break;
      }
      case 'rematch':
        if (g.status !== 'over') return resend();
        g.rematch[side] = true;
        if (g.rematch.w && g.rematch.b) {
          // the next game: colours change hands
          g.seats = { w: g.seats.b, b: g.seats.w };
          g.round++;
          g.moves = [];
          g.sans = [];
          g.fen = START;
          g.status = 'playing';
          g.result = null;
          g.drawOffer = null;
          g.rematch = { w: false, b: false };
          g.left = { w: g.left.b, b: g.left.w };
          if (g.clock) g.clock = { ...g.clock, w: g.clock.base, b: g.clock.base, at: null };
          this.board = null;
        }
        break;
      case 'state':
        return resend();
      default:
        return;
    }
    await this.store(g);
    this.broadcast(g);
  }

  async webSocketClose(ws: WebSocket, code: number) {
    const g = await this.load();
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye');
    } catch {
      /* already closed */
    }
    if (!g) return;
    const side = this.sideOf(g, (ws.deserializeAttachment() as { token?: string })?.token);
    if (!side || this.present(g, side, ws)) return;
    g.left[side] = Date.now();
    await this.store(g);
    this.broadcast(g, ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws, 1011);
  }

  async alarm() {
    const g = await this.load();
    if (!g) return;
    const now = Date.now();
    if (g.status === 'playing' && g.clock?.at != null && this.remaining(g, this.turn(g), now) <= 0) {
      const s = this.turn(g);
      g.clock[s] = 0;
      g.clock.at = null;
      this.finish(g, this.onTime(g, other(s)), 'time');
      await this.store(g);
      this.broadcast(g);
      return;
    }
    if (now - g.touched >= DAY && !this.ctx.getWebSockets().length) {
      await this.ctx.storage.deleteAll();
      this.game = null;
      return;
    }
    await this.schedule(g);
  }
}
