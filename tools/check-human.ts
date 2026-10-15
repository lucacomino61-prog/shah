// Spot checks of the starter bots' eye on fixed positions (no engine): how often each takes a free queen, plays a
// mate in one, and saves a piece that is attacked and loose.
//   node --experimental-strip-types tools/check-human.ts
import { Chess } from 'chess.js';
import { LEVELS, pickMove } from '../src/lib/levels.ts';
import type { Analysis } from '../src/lib/engine.ts';

const cases = [
  // black's queen on d4 is loose and the knight on f3 can take it
  { name: 'takes a free queen', fen: 'rnb1kbnr/pppp1ppp/8/4p3/3q4/5N2/PPPPPPPP/RNBQKB1R w KQkq - 0 3', good: (u: string) => u === 'f3d4' },
  // scholar's mate on f7
  { name: 'plays a mate in one', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', good: (u: string) => u === 'h5f7' },
  // white's bishop on g5 is attacked by the pawn on h6 and loose
  { name: 'saves an attacked bishop', fen: 'rnbqkb1r/pppp1pp1/5n1p/4p1B1/4P3/2N5/PPPP1PPP/R2QKBNR w KQkq - 0 4', good: (u: string) => u.startsWith('g5') },
];
const N = 300;
for (const l of LEVELS.filter((x) => x.slip === 1)) {
  const row = cases.map((c) => {
    const chess = new Chess(c.fen);
    const legal = chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ''));
    const a: Analysis = { fen: c.fen, bestmove: null, depth: 0, lines: [] };
    let hit = 0;
    for (let i = 0; i < N; i++) if (c.good(pickMove(a, l, c.fen, legal) ?? '')) hit++;
    return `${c.name} ${Math.round((100 * hit) / N)}%`;
  });
  console.log(`${l.n} ${l.bot.padEnd(7)} ${row.join(' · ')}`);
}
