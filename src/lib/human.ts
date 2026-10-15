// A player's eye, not an engine's (Luca, 2026-10-15: "make the bot to act more like a human"). A person at the board
// does not search: they see some things and miss others. A beginner sees a piece left hanging and grabs it, often
// fails to notice that the piece they just moved can be taken, gives check because check feels strong, brings the
// queen out early, and every so often walks past a mate. The starter bots play from this eye alone; the stronger
// ones play the engine's lines and use it only for their slips, so even their mistakes are mistakes a person makes.

import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';

export interface Eye {
  /** chance to notice that the piece just moved can be taken for free (or for less than it is worth) */
  safety: number;
  /** chance to notice a piece of its own left loose somewhere else after the move */
  threats: number;
  /** chance to see a capture that wins material */
  greed: number;
  /** chance to see a mate in one */
  mate: number;
  /** chance to see that the move allows a mate in one */
  defend: number;
  /** tastes, in pawns: checks, developing the minor pieces, the centre, castling, early queen moves, pawn pushes */
  style: { check: number; develop: number; centre: number; castle: number; queen: number; push: number };
  /** how much taste varies from move to move, in pawns */
  noise: number;
}

const VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3.2, r: 5, q: 9, k: 0 };
const CENTRE = new Set(['d4', 'e4', 'd5', 'e5']);
const HOME_MINOR: Record<Color, string[]> = { w: ['b1', 'g1', 'c1', 'f1'], b: ['b8', 'g8', 'c8', 'f8'] };

/** Gaussian noise (Box-Muller). */
function gauss(rnd: () => number) {
  const u = Math.max(1e-9, rnd());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
}

/** What a piece standing on `sq` would cost if the side to move took it: nothing if it is safe. */
function exposure(c: Chess, sq: Square, owner: Color): number {
  const piece = c.get(sq);
  if (!piece || piece.type === 'k') return 0;
  const enemy: Color = owner === 'w' ? 'b' : 'w';
  const attackers = c.attackers(sq, enemy);
  if (!attackers.length) return 0;
  const cheapest = Math.min(...attackers.map((a) => VALUE[c.get(a)!.type] || 100));
  const defended = c.attackers(sq, owner).length > 0;
  return defended ? Math.max(0, VALUE[piece.type] - cheapest) : VALUE[piece.type];
}

/** The worst loose piece of `owner` on the board (not counting the king), as material. */
function worstLoose(c: Chess, owner: Color, except?: Square): number {
  let worst = 0;
  for (const row of c.board())
    for (const p of row) {
      if (!p || p.color !== owner || p.type === 'k' || p.square === except) continue;
      worst = Math.max(worst, exposure(c, p.square, owner));
    }
  return worst;
}

/** Does the side to move have a mate in one here? */
function mateInOne(c: Chess): boolean {
  for (const m of c.moves({ verbose: true })) {
    c.move(m);
    const mate = c.isCheckmate();
    c.undo();
    if (mate) return true;
  }
  return false;
}

/** How a person with this eye rates each legal move here, best first. */
export function rateMoves(fen: string, eye: Eye, rnd: () => number = Math.random): { move: Move; score: number }[] {
  const c = new Chess(fen);
  const me = c.turn();
  const ply = (c.moveNumber() - 1) * 2 + (me === 'b' ? 1 : 0);
  const moves = c.moves({ verbose: true });
  // what they see of the danger already on the board: the same for every candidate (a person either has noticed the
  // attacked piece or not)
  const seesThreats = rnd() < eye.threats;
  const out: { move: Move; score: number }[] = [];
  for (const m of moves) {
    let s = 0;
    c.move(m);
    if (c.isCheckmate()) s += rnd() < eye.mate ? 1000 : 0;
    // the material they see themselves winning
    if (m.captured && rnd() < eye.greed) s += VALUE[m.captured];
    if (m.promotion) s += VALUE[m.promotion] - 1;
    // the piece just moved: taken for nothing?
    const lost = exposure(c, m.to as Square, me);
    if (lost && rnd() < eye.safety) s -= lost * 0.95;
    // something else left loose
    if (seesThreats) s -= worstLoose(c, me, m.to as Square) * 0.9;
    // a mate in one given away
    if (eye.defend && !c.isGameOver() && rnd() < eye.defend && mateInOne(c)) s -= 500;
    if (c.inCheck()) s += eye.style.check;
    c.undo();
    // tastes
    const opening = ply < 20;
    if (m.flags.includes('k') || m.flags.includes('q')) s += eye.style.castle;
    else if (m.piece === 'k') s -= 0.35;
    if (opening && (m.piece === 'n' || m.piece === 'b') && HOME_MINOR[me].includes(m.from)) s += eye.style.develop;
    if (opening && m.piece === 'p' && CENTRE.has(m.to)) s += eye.style.centre;
    if (opening && m.piece === 'q') s += eye.style.queen;
    if (m.piece === 'p') s += eye.style.push * (m.to[0] === 'a' || m.to[0] === 'h' ? 0.3 : 1);
    s += gauss(rnd) * eye.noise;
    out.push({ move: m, score: s });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** The move a person with this eye plays here (uci), or null when there is none. */
export function humanMove(fen: string, eye: Eye, rnd: () => number = Math.random): string | null {
  const rated = rateMoves(fen, eye, rnd);
  if (!rated.length) return null;
  const m = rated[0].move;
  return m.from + m.to + (m.promotion ?? '');
}
