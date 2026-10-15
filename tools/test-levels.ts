// The level ladder, checked by play: each bot against the one above it, and how each plays (how often it leaves the
// piece it moved en prise, how often it takes a piece left hanging, how long games last). Starter bots need no
// engine; the others use the same lite Stockfish as the page.
//
//   node --experimental-strip-types tools/test-levels.ts [games per pair = 10] [highest level shown = 5]

import { Chess, type Square } from 'chess.js';
import { LEVELS, pickMove, type Level } from '../src/lib/levels.ts';
import type { Analysis } from '../src/lib/engine.ts';
import { startEngine } from './sf.mjs';

const GAMES = Number(process.argv[2] ?? 10);
const TOP = Number(process.argv[3] ?? 5);
const sf = startEngine();
const empty = (fen: string): Analysis => ({ fen, bestmove: null, depth: 0, lines: [] });
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

interface Habits {
  moves: number;
  hung: number;
  freeSeen: number;
  freeTaken: number;
}
const habits = new Map<number, Habits>();
const habit = (l: Level) => {
  if (!habits.has(l.n)) habits.set(l.n, { moves: 0, hung: 0, freeSeen: 0, freeTaken: 0 });
  return habits.get(l.n)!;
};

/** a piece of `colour` en prise on `sq`: attacked and not defended, or attacked by something cheaper */
function loose(c: Chess, sq: Square, colour: 'w' | 'b'): boolean {
  const p = c.get(sq);
  if (!p || p.type === 'k') return false;
  const enemy = colour === 'w' ? 'b' : 'w';
  const att = c.attackers(sq, enemy);
  if (!att.length) return false;
  const cheapest = Math.min(...att.map((a) => VALUE[c.get(a)!.type] || 100));
  return !c.attackers(sq, colour).length || cheapest < VALUE[p.type];
}

async function choose(c: Chess, l: Level): Promise<string | null> {
  const fen = c.fen();
  const legal = c.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
  const engineNeeded = !l.eye || l.slip < 1;
  const a = engineNeeded ? await sf.analyse(fen, { depth: l.depth > 12 ? 12 : l.depth, multipv: Math.max(1, l.lines) }) : empty(fen);
  return pickMove(a as Analysis, l, fen, legal);
}

async function game(white: Level, black: Level): Promise<'w' | 'b' | 'draw'> {
  const c = new Chess();
  for (let ply = 0; ply < 220 && !c.isGameOver(); ply++) {
    const l = c.turn() === 'w' ? white : black;
    const me = c.turn();
    // a free piece of the other side on the board before the move?
    const free = c
      .moves({ verbose: true })
      .filter((m) => m.captured && VALUE[m.captured] >= 3)
      .some((m) => {
        c.move(m);
        const lost = loose(c, m.to as Square, me);
        c.undo();
        return !lost;
      });
    const uci = await choose(c, l);
    if (!uci) break;
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
    const h = habit(l);
    h.moves++;
    if (loose(c, m.to as Square, me) && VALUE[m.piece] >= 3 && !m.captured) h.hung++;
    if (free) {
      h.freeSeen++;
      if (m.captured && VALUE[m.captured] >= 3) h.freeTaken++;
    }
  }
  if (c.isCheckmate()) return c.turn() === 'w' ? 'b' : 'w';
  // a long game: the side ahead in material by three or more
  let diff = 0;
  for (const row of c.board()) for (const p of row) if (p) diff += (p.color === 'w' ? 1 : -1) * VALUE[p.type];
  return diff >= 3 ? 'w' : diff <= -3 ? 'b' : 'draw';
}

const ladder = LEVELS.filter((l) => l.n <= TOP).sort((a, b) => a.n - b.n);
let ok = true;
for (let i = 0; i + 1 < ladder.length; i++) {
  const lo = ladder[i];
  const hi = ladder[i + 1];
  let hiScore = 0;
  for (let g = 0; g < GAMES; g++) {
    const hiWhite = g % 2 === 0;
    const r = await game(hiWhite ? hi : lo, hiWhite ? lo : hi);
    hiScore += r === 'draw' ? 0.5 : (r === 'w') === hiWhite ? 1 : 0;
  }
  const share = hiScore / GAMES;
  const pass = share >= 0.6;
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${hi.bot} (${hi.n}) beats ${lo.bot} (${lo.n}): ${hiScore}/${GAMES}`);
}
console.log('\nhow each plays:');
for (const l of ladder) {
  const h = habits.get(l.n);
  if (!h) continue;
  console.log(
    `  ${String(l.n).padStart(2)} ${l.bot.padEnd(9)} leaves the moved piece en prise ${((100 * h.hung) / h.moves).toFixed(1)}% of moves; takes a hanging piece ${h.freeSeen ? ((100 * h.freeTaken) / h.freeSeen).toFixed(0) : '-'}% of the time (${h.freeSeen} chances)`,
  );
}
sf.quit();
console.log(ok ? '\nthe ladder climbs' : '\nTHE LADDER DOES NOT CLIMB');
process.exit(ok ? 0 : 1);
