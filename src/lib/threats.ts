// What the learner can lose right now: the pieces the opponent could win on the next move. A piece is in danger
// when it is attacked and nothing defends it, or when the cheapest attacker is worth less than it is (a pawn on a
// knight, a knight on a rook). The king is left out: check has its own mark.

import { Chess, type Color, type Square } from 'chess.js';

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

export function inDanger(fen: string, side: Color): Square[] {
  const chess = new Chess(fen);
  const them: Color = side === 'w' ? 'b' : 'w';
  const out: Square[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== side || p.type === 'k') continue;
      const attackers = chess.attackers(p.square, them);
      if (!attackers.length) continue;
      const defended = chess.attackers(p.square, side).length > 0;
      const cheapest = Math.min(...attackers.map((s) => VALUE[chess.get(s)!.type]));
      if (!defended || cheapest < VALUE[p.type]) out.push(p.square);
    }
  }
  return out;
}
