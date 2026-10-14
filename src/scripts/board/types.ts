// What every board view (the marble one in 3D, the flat one in SVG) offers the pages that drive it.

export type Sq = string;
export type Side = 'w' | 'b';
export type Kind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';

export interface Arrow {
  from: Sq;
  to: Sq;
  /** a number drawn at the tail: the order of a demonstrated line */
  label?: string;
  /** pointer: the commentator's line; quiet: a threat or a hint, drawn fainter */
  tone?: 'pointer' | 'quiet';
}

export interface Marks {
  last?: [Sq, Sq] | null;
  check?: Sq | null;
  arrows?: Arrow[];
  /** squares the hint points at (the piece to move) */
  focus?: Sq[];
  /** the learner's pieces the opponent could win next move (the Show-threats switch) */
  danger?: Sq[];
}

export interface BoardOptions {
  host: HTMLElement;
  orientation: Side;
  /** whether motion is allowed right now (the Stop-animations switch and the OS setting) */
  motion: () => boolean;
  /** legal targets of the piece on a square, empty when it may not move now */
  dests: (sq: Sq) => Sq[];
  /** the user asked to move; the page decides (and may ask which piece a pawn becomes) */
  onMove: (from: Sq, to: Sq) => void;
  /** spoken name of the board for screen readers */
  label: string;
  /** a game keeps what was taken lying beside the board; a puzzle or a lesson that jumps to a new position puts
   *  the pieces it does not use away instead (default true) */
  keepTaken?: boolean;
  /** a page that takes over taps on squares (setting up a position) returns true for the ones it handled */
  onSquare?: (sq: Sq) => boolean;
}

export interface BoardView {
  readonly kind: '3d' | '2d';
  /** show a position; pieces travel from where they stood when `animate` is set and motion is on */
  setPosition(fen: string, animate?: boolean): void;
  setOrientation(side: Side): void;
  setMarks(marks: Marks): void;
  /** whether the user may move pieces now */
  setInteractive(on: boolean): void;
  /** the 3D board moves its camera to the next angle and names it */
  cycleAngle?(): string;
  /** the 3D board: frame the board again in the space the overlays leave (CSS --inset-*) */
  refit?(): void;
  /** the 3D board: one of the named camera angles */
  setAngle?(i: number): void;
  /** the 3D board: a slow swing of the camera round the table, radians of phase per second (0 stops it) */
  orbit?(speed: number): void;
  /** a word on the frame while the board is not showing the game (ANALIZË) */
  setPlate(text: string | null): void;
  /** a press on a square, from a tap or the keyboard: choose a piece, move it, or let go */
  press(sq: Sq): void;
  /** the keyboard cursor */
  setCursor(sq: Sq | null): void;
  /** the chosen piece, if any */
  readonly chosen: Sq | null;
  tick(seconds: number): void;
  setMotion(on: boolean): void;
  /** true while pieces are still travelling */
  readonly busy: boolean;
  dispose(): void;
}

export const FILES = 'abcdefgh';
export const sqIndex = (s: Sq) => (Number(s[1]) - 1) * 8 + FILES.indexOf(s[0]);
export const sqName = (i: number) => FILES[i & 7] + ((i >> 3) + 1);

export interface Placed {
  side: Side;
  kind: Kind;
}

/** The pieces of a FEN by square. */
export function readFen(fen: string): Map<Sq, Placed> {
  const out = new Map<Sq, Placed>();
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      const side: Side = ch === ch.toUpperCase() ? 'w' : 'b';
      out.set(FILES[f] + (8 - r), { side, kind: ch.toLowerCase() as Kind });
      f++;
    }
  });
  return out;
}

export interface Travel {
  from: Sq;
  to: Sq;
  /** the piece changes kind on arrival (a promotion, or a jump back across a promotion) */
  becomes?: Kind;
}

export interface Plan {
  stay: Sq[];
  travel: Travel[];
  /** pieces that leave the board */
  taken: Sq[];
  /** pieces that come back onto the board */
  arrive: { to: Sq; side: Side; kind: Kind }[];
}

const dist = (a: Sq, b: Sq) => Math.hypot(FILES.indexOf(a[0]) - FILES.indexOf(b[0]), Number(a[1]) - Number(b[1]));

/**
 * How to get from one position to another with the fewest pieces moving: keep what stands still, send each piece
 * to the nearest square of its own kind, turn a leftover pawn into a new piece, and take or bring back the rest.
 */
export function planMoves(from: Map<Sq, Placed>, to: Map<Sq, Placed>): Plan {
  const plan: Plan = { stay: [], travel: [], taken: [], arrive: [] };
  const oldLeft = new Map(from);
  const newLeft = new Map(to);
  for (const [sq, p] of to) {
    const o = from.get(sq);
    if (o && o.side === p.side && o.kind === p.kind) {
      plan.stay.push(sq);
      oldLeft.delete(sq);
      newLeft.delete(sq);
    }
  }
  const pair = (match: (o: Placed, n: Placed) => boolean, morph: boolean) => {
    const pairs: [number, Sq, Sq][] = [];
    for (const [os, o] of oldLeft) for (const [ns, n] of newLeft) if (match(o, n)) pairs.push([dist(os, ns) + (o.kind === 'p' ? 0 : morph ? 0.5 : 0), os, ns]);
    pairs.sort((a, b) => a[0] - b[0]);
    for (const [, os, ns] of pairs) {
      if (!oldLeft.has(os) || !newLeft.has(ns)) continue;
      const o = oldLeft.get(os)!;
      const n = newLeft.get(ns)!;
      plan.travel.push(o.kind === n.kind ? { from: os, to: ns } : { from: os, to: ns, becomes: n.kind });
      oldLeft.delete(os);
      newLeft.delete(ns);
    }
  };
  pair((o, n) => o.side === n.side && o.kind === n.kind, false);
  // a pawn that reached the last rank, or a queen going back to being a pawn
  pair((o, n) => o.side === n.side && (o.kind === 'p' || n.kind === 'p') && o.kind !== 'k' && n.kind !== 'k', true);
  plan.taken.push(...oldLeft.keys());
  for (const [sq, p] of newLeft) plan.arrive.push({ to: sq, side: p.side, kind: p.kind });
  return plan;
}
