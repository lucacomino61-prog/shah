// Checks every repertoire: legal lines, exactly one move for the learner in each position (by position, so
// transpositions count), and each of the learner's moves within 0.7 pawns of the engine's best.
// Run: node tools/check-repertoires.ts
import { Chess } from 'chess.js';
import { REPERTOIRES } from '../src/data/repertoires.ts';
import { startEngine } from './sf.mjs';

const sf = startEngine();
let failed = 0;
const key = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
const score = (l: { cp?: number; mate?: number } | undefined) => (!l ? 0 : l.mate !== undefined ? (l.mate > 0 ? 100000 : -100000) : (l.cp ?? 0));

for (const rep of REPERTOIRES) {
  const mine = new Map<string, { san: string; uci: string; line: string }>();
  for (const line of rep.lines) {
    const c = new Chess();
    for (const san of line.moves.split(' ')) {
      const before = c.fen();
      let m;
      try {
        m = c.move(san);
      } catch {
        failed++;
        console.log(`FAIL  ${rep.slug} / ${line.name}: illegal ${san}`);
        break;
      }
      if (m.color !== rep.side) continue;
      const k = key(before);
      const prev = mine.get(k);
      if (prev && prev.san !== m.san) {
        failed++;
        console.log(`FAIL  ${rep.slug}: two answers in one position: ${prev.san} (${prev.line}) and ${m.san} (${line.name})`);
      }
      mine.set(k, { san: m.san, uci: m.from + m.to + (m.promotion ?? ''), line: line.name });
    }
  }
  // the engine on each of the learner's positions
  let worst = 0;
  for (const [k, v] of mine) {
    const fen = `${k} 0 1`;
    const a = await sf.analyse(fen, { depth: 12, multipv: 1 });
    const best = score(a.lines[0]);
    const c = new Chess(fen);
    c.move(v.san);
    const b = await sf.analyse(c.fen(), { depth: 12 });
    const played = -score(b.lines[0]);
    const loss = best - played;
    worst = Math.max(worst, loss);
    if (loss > 70) {
      failed++;
      console.log(`FAIL  ${rep.slug} / ${v.line}: ${v.san} loses ${loss}cp (engine prefers ${a.bestmove})`);
    }
  }
  console.log(`${rep.slug}: ${rep.lines.length} lines, ${mine.size} positions for the learner, worst loss ${worst}cp`);
}
sf.quit();
console.log(failed ? `\n${failed} FAILED` : '\nall repertoires check out');
process.exit(failed ? 1 : 0);
