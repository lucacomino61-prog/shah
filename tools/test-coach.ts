// Checks the coach's grades and sentences on positions with a known answer, against the real engine.
// Run: npm test
import { Chess } from 'chess.js';
import { judge, threatWarning, passTurn } from '../src/lib/coach.ts';
import { openingOf } from '../src/lib/openings.ts';
import { startEngine } from './sf.mjs';

const sf = startEngine();
let failed = 0;
const ok = (cond: boolean, label: string, extra = '') => {
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};

function fenAfter(moves: string[]) {
  const c = new Chess();
  for (const m of moves) c.move(m);
  return { fen: c.fen(), history: c.history() };
}

async function verdict(fen: string, uci: string, history: string[] = []) {
  const before = await sf.analyse(fen, { depth: 14, multipv: 2 });
  const c = new Chess(fen);
  c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
  const after = c.isGameOver() ? { fen: c.fen(), bestmove: null, depth: 0, lines: [] } : await sf.analyse(c.fen(), { depth: 14, multipv: 1 });
  return judge({ fen, uci, history, before, after });
}

// 1. a move that allows mate in one (Scholar's mate pattern)
{
  const { fen, history } = fenAfter(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4']);
  const v = await verdict(fen, 'g8f6', history);
  ok(v.grade === 'blunder', 'Nf6?? allowing Qxf7# is a blunder', v.grade);
  ok(v.reasons.some((r) => r.includes('mat menjëherë') && r.includes('Qxf7#')), 'names the mate', v.reasons.join(' / '));
  ok(v.tags.includes('allowed-mate'), 'tag allowed-mate');
}

// 2. a queen left where a knight takes it
{
  const { fen, history } = fenAfter(['e4', 'e5', 'Nf3']);
  const v = await verdict(fen, 'd8g5', history);
  ok(v.grade === 'blunder', 'Qg5?? is a blunder', v.grade);
  ok(v.reasons.some((r) => r.includes('Mbretëresha jote në g5 mbeti pa mbrojtje') && r.includes('Nxg5')), 'says the queen hangs', v.reasons.join(' / '));
}

// 3. a fair trade is not called a loss
{
  const { fen, history } = fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  const v = await verdict(fen, 'b5c6', history);
  ok(!['mistake', 'blunder'].includes(v.grade), 'Bxc6 (exchange Spanish) is not a mistake', v.grade);
  ok(!v.reasons.some((r) => r.includes('humbet')), 'no "loses" sentence for a trade', v.reasons.join(' / '));
}

// 4. a knight fork left on the board
{
  const fen = 'r3k3/7p/8/1N6/8/8/8/4K3 b - - 0 1';
  const v = await verdict(fen, 'h7h6');
  ok(['mistake', 'blunder'].includes(v.grade), 'h6 ignoring Nc7+ is a mistake or worse', v.grade);
  ok(v.reasons.some((r) => r.includes('pirun') && r.includes('Nc7+')), 'names the fork', v.reasons.join(' / '));
}

// 5. a free queen not taken
{
  const fen = 'rnb1kbnr/pppp1ppp/8/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  const v = await verdict(fen, 'b1c3');
  ok(v.grade === 'blunder', 'not taking the queen is a blunder', v.grade);
  ok(v.reasons.some((r) => r.includes('Mund të merrje mbretëreshën e tij') && r.includes('Nxg5')), 'points at Nxg5', v.reasons.join(' / '));
}

// 6. a good opening move is theory, castling is praised
{
  const { fen, history } = fenAfter(['e4', 'c5']);
  const v = await verdict(fen, 'g1f3', history);
  ok(v.grade === 'book', 'Nf3 in the Sicilian is theory', v.grade);
  const { fen: f2, history: h2 } = fenAfter(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
  const v2 = await verdict(f2, 'e1g1', h2);
  ok(['good', 'best', 'book'].includes(v2.grade), 'O-O in the Giuoco Piano is fine', v2.grade);
  ok(v2.reasons.some((r) => r.startsWith('Rokadë')), 'castling praised', v2.reasons.join(' / '));
}

// 7. mate delivered
{
  const { fen, history } = fenAfter(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6']);
  const v = await verdict(fen, 'h5f7', history);
  ok(v.reasons[0] === 'Shah mat. Fitove!', 'mate is announced', v.reasons.join(' / '));
}

// 8. threats: a knight attacked by a pawn
{
  const fen = 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3';
  // black to move would play ...? check the threat helper on a position where black threatens d5-d4 forks etc.
  const passed = passTurn(fen);
  ok(!!passed, 'turn can be passed when not in check');
  const t = await sf.analyse('rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', { depth: 10 });
  ok(!!t.bestmove, 'engine answers');
  const hang = 'rnbqkb1r/pppp1ppp/8/4p3/4n3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 3';
  // a white knight on c3 attacked by a pawn on d4 (the Vienna trick ...Nxe4 is no threat: ...d5 wins it back)
  const pos = 'rnbqkbnr/ppp1pppp/8/8/3p4/2N5/PPPPPPPP/R1BQKBNR w KQkq - 0 3';
  const a = await sf.analyse(passTurn(pos)!, { depth: 10 });
  const w = threatWarning(pos, a);
  ok(w !== null && w.includes('kali yt në c3'), 'warns that the knight on c3 is attacked', String(w));
  void hang;
}

// 9. the book names openings
{
  ok(openingOf(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'])?.name === 'Mbrojtja Siciliane, Najdorf', 'Najdorf named');
  ok(openingOf(['d4', 'd5', 'c4', 'e6'])?.name === 'Gambiti i Mbretëreshës, i refuzuar', 'QGD named');
  ok(openingOf(['a4']) === null, 'no name for 1.a4');
}

sf.quit();
console.log(failed ? `\n${failed} FAILED` : '\nall passed');
process.exit(failed ? 1 : 0);
