// The Show-threats rule on known positions: attacked and undefended, or attacked by a cheaper piece.
// node --experimental-strip-types tools/test-threats.ts
import { inDanger } from '../src/lib/threats.ts';

let failed = 0;
const check = (label: string, fen: string, side: 'w' | 'b', want: string[]) => {
  const got = inDanger(fen, side).sort();
  const ok = JSON.stringify(got) === JSON.stringify([...want].sort());
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  | ${got.join(' ') || 'none'}`);
};
// 1.e4 c5 2.Ba6: the bishop stands where the b7 pawn takes it
check('a bishop left en prise to a pawn', 'rnbqkbnr/pp1ppppp/B7/2p5/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2', 'w', ['a6']);
// the start: nothing is attacked
check('the opening position is safe', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'w', []);
// a knight on d5 attacked by the c6 pawn though defended by e4: attacked by something cheaper
check('a defended knight attacked by a pawn', 'rnbqkbnr/pp1ppppp/2p5/3N4/4P3/8/PPPP1PPP/R1BQKBNR w KQkq - 0 3', 'w', ['d5']);
// a rook defended by its king and attacked by a rook: an even trade, not a danger
check('an even trade is not a danger', 'k7/8/8/8/8/8/r7/RK6 w - - 0 1', 'w', []);
console.log(failed ? `\n${failed} FAILED` : '\nthreats check out');
process.exit(failed ? 1 : 0);
