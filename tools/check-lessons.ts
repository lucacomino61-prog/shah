// Checks every lesson step: the position is legal, the moves of each task are legal in order, and the learner's
// first move (and every accepted alternative) is as good as the engine's best. Run: node tools/check-lessons.ts
import { Chess } from 'chess.js';
import { LESSONS } from '../src/data/lessons.ts';
import { startEngine } from './sf.mjs';

const sf = startEngine();
let failed = 0;
const score = (l: { cp?: number; mate?: number } | undefined) => (!l ? 0 : l.mate !== undefined ? (l.mate > 0 ? 100000 - l.mate : -100000 - l.mate) : (l.cp ?? 0));

for (const lesson of LESSONS) {
  for (const [i, step] of lesson.steps.entries()) {
    const label = `${lesson.slug} #${i + 1} ${step.title}`;
    let chess: Chess;
    try {
      chess = new Chess(step.fen);
      if (step.setup) chess.move({ from: step.setup.slice(0, 2), to: step.setup.slice(2, 4), promotion: step.setup[4] || undefined });
    } catch (e) {
      failed++;
      console.log(`FAIL  ${label}: bad position or setup (${(e as Error).message})`);
      continue;
    }
    if (step.playout) {
      const a = await sf.analyse(chess.fen(), { depth: 16 });
      const l = a.lines[0];
      const won = l?.mate !== undefined ? l.mate > 0 : (l?.cp ?? 0) > 400;
      if (!won) failed++;
      console.log(`${won ? 'ok   ' : 'FAIL '} ${label}: play-out starts ${l?.mate !== undefined ? `mate in ${l.mate}` : `${l?.cp}cp`}`);
      continue;
    }
    if (!step.task) {
      console.log(`ok    ${label}`);
      continue;
    }
    const start = chess.fen();
    try {
      const c = new Chess(start);
      for (const u of step.task.moves) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
    } catch (e) {
      failed++;
      console.log(`FAIL  ${label}: task moves illegal (${(e as Error).message})`);
      continue;
    }
    const best = await sf.analyse(start, { depth: 14 });
    const top = score(best.lines[0]);
    for (const u of [step.task.moves[0], ...(step.task.also ?? [])]) {
      const c = new Chess(start);
      c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
      let mine: number;
      if (c.isCheckmate()) mine = 100000;
      else {
        const a = await sf.analyse(c.fen(), { depth: 13 });
        mine = -score(a.lines[0]);
      }
      // a mate in fewer moves than the best is fine; otherwise within 0.6 pawns of the best (opening steps)
      const ok = mine >= top - (step.task.also ? 60 : 30) || (top > 90000 && mine > 90000);
      if (!ok) failed++;
      console.log(`${ok ? 'ok   ' : 'FAIL '} ${label}: ${u} scores ${mine} against best ${best.bestmove} ${top}`);
    }
  }
}
sf.quit();
console.log(failed ? `\n${failed} FAILED` : '\nall lesson steps check out');
process.exit(failed ? 1 : 0);
