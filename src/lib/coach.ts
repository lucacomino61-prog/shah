// The commentator: turns two engine searches (before and after a move) into a grade and plain Albanian sentences.
// Pure functions over chess.js, so the rules can be tested in Node (tools/test-coach.ts).
//
// Sentences carry moves as [[SAN]] marks; the page draws them with figurines.

import { Chess, type Move, type Square } from 'chess.js';
import type { Analysis, Line } from './engine.ts';
import { inBook } from './openings.ts';

export type Grade = 'brilliant' | 'best' | 'good' | 'book' | 'forced' | 'inaccuracy' | 'mistake' | 'blunder';
type Kind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
type Color = 'w' | 'b';

export const GRADES: Record<Grade, { symbol: string; title: string }> = {
  brilliant: { symbol: '!!', title: 'Shkëlqyeshëm' },
  best: { symbol: '!', title: 'Më e mira' },
  good: { symbol: '', title: 'E mirë' },
  book: { symbol: '', title: 'E njohur' },
  forced: { symbol: '', title: 'E detyruar' },
  inaccuracy: { symbol: '?!', title: 'Pasaktësi' },
  mistake: { symbol: '?', title: 'Gabim' },
  blunder: { symbol: '??', title: 'Gabim i rëndë' },
};

/** Mistake families, counted on the progress page. */
export type Tag =
  | 'hanging'
  | 'lost-material'
  | 'missed-capture'
  | 'allowed-fork'
  | 'missed-fork'
  | 'allowed-mate'
  | 'missed-mate'
  | 'early-queen'
  | 'same-piece'
  | 'rim-knight'
  | 'f-pawn';

export const TAG_NAMES: Record<Tag, string> = {
  hanging: 'Figura pa mbrojtje',
  'lost-material': 'Humbje materiali',
  'missed-capture': 'Kapje e humbur',
  'allowed-fork': 'Pirun i lejuar',
  'missed-fork': 'Pirun i humbur',
  'allowed-mate': 'Mat i lejuar',
  'missed-mate': 'Mat i humbur',
  'early-queen': 'Mbretëresha herët',
  'same-piece': 'E njëjta figurë dy herë',
  'rim-knight': 'Kali në buzë',
  'f-pawn': 'Ushtari f herët',
};

const VALUE: Record<Kind, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** How the sentences name a piece. */
export const PIECE: Record<Kind, { the: string; theAcc: string; one: string; yours: string; yoursAcc: string; theirsAcc: string }> = {
  p: { the: 'ushtari', theAcc: 'ushtarin', one: 'një ushtar', yours: 'Ushtari yt', yoursAcc: 'ushtarin tënd', theirsAcc: 'ushtarin e tij' },
  n: { the: 'kali', theAcc: 'kalin', one: 'një kalë', yours: 'Kali yt', yoursAcc: 'kalin tënd', theirsAcc: 'kalin e tij' },
  b: { the: 'oficeri', theAcc: 'oficerin', one: 'një oficer', yours: 'Oficeri yt', yoursAcc: 'oficerin tënd', theirsAcc: 'oficerin e tij' },
  r: { the: 'torra', theAcc: 'torrën', one: 'një torrë', yours: 'Torra jote', yoursAcc: 'torrën tënde', theirsAcc: 'torrën e tij' },
  q: { the: 'mbretëresha', theAcc: 'mbretëreshën', one: 'mbretëreshën', yours: 'Mbretëresha jote', yoursAcc: 'mbretëreshën tënde', theirsAcc: 'mbretëreshën e tij' },
  k: { the: 'mbreti', theAcc: 'mbretin', one: 'mbretin', yours: 'Mbreti yt', yoursAcc: 'mbretin tënd', theirsAcc: 'mbretin e tij' },
};

// ------------------------------------------------------------------ numbers

/** Winning chances in -1..1 from a centipawn score (Lichess's curve). */
export function winChance(cp: number): number {
  return 2 / (1 + Math.exp(-0.00368208 * cp)) - 1;
}

/** A search line as centipawns for the side to move; mates become very large scores. */
export function lineScore(l: Line | undefined): number {
  if (!l) return 0;
  if (l.mate !== undefined) return l.mate > 0 ? 100000 - l.mate * 100 : -100000 - l.mate * 100;
  return l.cp ?? 0;
}

const chance = (l: Line | undefined) => (l?.mate !== undefined ? (l.mate > 0 ? 1 : -1) : winChance(l?.cp ?? 0));

/** Lichess's accuracy for one move, from the mover's win percent before and after. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
  const drop = Math.max(0, winBefore - winAfter);
  return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * drop) - 3.1669));
}

/** The mover's win percent, 0..100. */
export const winPercent = (c: number) => 50 + 50 * c;

function material(chess: Chess, side: Color): number {
  let sum = 0;
  for (const row of chess.board()) for (const p of row) if (p && p.color === side) sum += VALUE[p.type as Kind];
  return sum;
}
const balance = (chess: Chess, side: Color) => material(chess, side) - material(chess, side === 'w' ? 'b' : 'w');

function play(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
  } catch {
    return null;
  }
}

/**
 * Follow a line a few plies (one more if the last step was a capture, so a recapture is counted) and return the
 * change in `side`'s material balance, plus the moves as played.
 */
export function lineMaterial(fen: string, pv: string[], side: Color, plies = 4): { swing: number; moves: Move[] } {
  const chess = new Chess(fen);
  const start = balance(chess, side);
  const moves: Move[] = [];
  let limit = Math.min(plies, pv.length);
  for (let i = 0; i < limit; i++) {
    const m = play(chess, pv[i]);
    if (!m) break;
    moves.push(m);
    if (i === limit - 1 && m.captured && limit < pv.length && limit < plies + 2) limit++;
  }
  return { swing: balance(chess, side) - start, moves };
}

/** SAN of a line from a position, as far as it stays legal. */
export function lineSan(fen: string, pv: string[], max = 6): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const u of pv.slice(0, max)) {
    const m = play(chess, u);
    if (!m) break;
    out.push(m.san);
  }
  return out;
}

export const uciSan = (fen: string, uci: string) => lineSan(fen, [uci], 1)[0] ?? uci;

/** Pieces of `victim`'s side that the piece now on `from` attacks and that it would gain by taking. */
function forkTargets(chess: Chess, from: Square, victim: Color): { kind: Kind; sq: Square }[] {
  const attacker = chess.get(from);
  if (!attacker) return [];
  const out: { kind: Kind; sq: Square }[] = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== victim) continue;
      if (!chess.attackers(p.square, attacker.color).includes(from)) continue;
      const kind = p.type as Kind;
      const defended = chess.attackers(p.square, victim).length > 0;
      if (kind === 'k' || VALUE[kind] > VALUE[attacker.type as Kind] || !defended) out.push({ kind, sq: p.square });
    }
  }
  return out;
}

const both = (a: string, b: string) => `${a} dhe ${b}`;

// ------------------------------------------------------------------ the verdict

export interface MoveContext {
  /** position before the move */
  fen: string;
  /** the move played, UCI */
  uci: string;
  /** SAN history of the game before this move */
  history: string[];
  /** search of the position before the move (best first; a second line helps find "only moves") */
  before: Analysis;
  /** search of the position after the move, from the opponent's side */
  after: Analysis;
}

export interface Verdict {
  grade: Grade;
  symbol: string;
  title: string;
  /** sentences, moves marked [[SAN]] */
  reasons: string[];
  /** the better move when the played one was not the best */
  better: { uci: string; san: string } | null;
  /** first moves of every line within a third of a pawn of the best: all of them solve this position */
  goodMoves: string[];
  /** position before the move: both lines below start here */
  fen: string;
  /** the move played and the opponent's best answer to it: "why" */
  refutation: string[];
  /** the engine's best line instead: "what was better" */
  bestLine: string[];
  /** mover's win percent before and after */
  winBefore: number;
  winAfter: number;
  accuracy: number;
  tags: Tag[];
  san: string;
}

export function judge(ctx: MoveContext): Verdict {
  const chess = new Chess(ctx.fen);
  const me = chess.turn() as Color;
  const them: Color = me === 'w' ? 'b' : 'w';
  const legal = chess.moves().length;
  const move = play(chess, ctx.uci);
  if (!move) throw new Error(`illegal move ${ctx.uci} in ${ctx.fen}`);
  const fenAfter = chess.fen();
  const history = [...ctx.history, move.san];

  const best = ctx.before.lines[0];
  const reply = ctx.after.lines[0];
  const bestUci = best?.pv[0] ?? ctx.before.bestmove ?? ctx.uci;
  const cBefore = chance(best);
  // the opponent's view, turned round; a mate on the board is the end of the story
  const cAfter = chess.isCheckmate() ? 1 : chess.isDraw() ? 0 : -chance(reply);
  const delta = cBefore - cAfter;
  const wb = winPercent(cBefore);
  const wa = winPercent(cAfter);

  const reasons: string[] = [];
  const tags: Tag[] = [];
  const isBest = ctx.uci === bestUci || (ctx.uci.slice(0, 4) === bestUci.slice(0, 4) && !bestUci[4]);
  const bestSan = uciSan(ctx.fen, bestUci);
  const replySan = reply?.pv[0] ? uciSan(fenAfter, reply.pv[0]) : null;

  // ------------------------------------------------ grade
  let grade: Grade;
  const missedMate = best?.mate !== undefined && best.mate > 0 && !chess.isCheckmate() && !(reply?.mate !== undefined && reply.mate < 0);
  const allowedMate = reply?.mate !== undefined && reply.mate > 0 && !(best?.mate !== undefined && best.mate < 0);
  if (legal === 1) grade = 'forced';
  else if (isBest || chess.isCheckmate()) grade = 'best';
  else if (allowedMate) grade = 'blunder';
  else if (missedMate) grade = cAfter > 0.5 ? 'inaccuracy' : 'mistake';
  else if (delta >= 0.3) grade = 'blunder';
  else if (delta >= 0.2) grade = 'mistake';
  else if (delta >= 0.1) grade = 'inaccuracy';
  else grade = 'good';
  if ((grade === 'good' || grade === 'best') && history.length <= 20 && inBook(history)) grade = 'book';

  // a sacrifice that holds: the best move gives up material along its own line, and the position stays good
  if (grade === 'best' && best && cBefore < 0.85 && cAfter > -0.2) {
    const sac = lineMaterial(ctx.fen, best.pv, me, 3).swing;
    const second = ctx.before.lines[1];
    const only = !second || chance(best) - chance(second) > 0.25;
    if (sac <= -2 && only) grade = 'brilliant';
  }

  const bad = grade === 'inaccuracy' || grade === 'mistake' || grade === 'blunder';

  // ------------------------------------------------ reasons for a bad move
  if (bad) {
    if (allowedMate && reply) {
      const n = reply.mate!;
      reasons.push(n === 1 ? `Kjo lejon mat menjëherë: [[${replySan}]].` : `Kjo lejon mat në ${n} lëvizje, duke filluar me [[${replySan}]].`);
      tags.push('allowed-mate');
    } else if (missedMate && best) {
      const n = best.mate!;
      reasons.push(n === 1 ? `Kishe mat menjëherë me [[${bestSan}]].` : `Kishe mat në ${n} lëvizje, duke filluar me [[${bestSan}]].`);
      tags.push('missed-mate');
    }

    // what the opponent's answer wins, counted from before the move so a fair trade is not called a loss
    const played = lineMaterial(ctx.fen, reply ? [ctx.uci, ...reply.pv] : [ctx.uci], me, 5);
    if (reply && !allowedMate) {
      const first = played.moves[1];
      if (played.swing <= -2 && first) {
        const victim = first.captured as Kind | undefined;
        if (victim && victim !== 'p') {
          const undefended = new Chess(fenAfter).attackers(first.to, me).length === 0;
          if (undefended) {
            reasons.push(`${PIECE[victim].yours} në ${first.to} mbeti pa mbrojtje: kundërshtari mund ta marrë me [[${first.san}]].`);
            tags.push('hanging');
          } else {
            reasons.push(`Nëse kundërshtari luan [[${first.san}]], humbet ${PIECE[victim].yoursAcc}.`);
            tags.push('lost-material');
          }
        } else {
          // the loss comes a move later: a fork, a pin, a trapped piece
          const pos = new Chess(fenAfter);
          const r = play(pos, reply.pv[0]);
          const targets = r ? forkTargets(pos, r.to, me) : [];
          if (r && targets.length >= 2) {
            const [a, b] = targets.sort((x, y) => (y.kind === 'k' ? 99 : VALUE[y.kind]) - (x.kind === 'k' ? 99 : VALUE[x.kind]));
            reasons.push(`Kundërshtari mund të bëjë sulm të dyfishtë (pirun): [[${r.san}]] sulmon ${both(PIECE[a.kind].yoursAcc, PIECE[b.kind].yoursAcc)}.`);
            tags.push('allowed-fork');
          } else {
            reasons.push(`Nëse kundërshtari luan [[${replySan}]], humbet material.`);
            tags.push('lost-material');
          }
        }
      }
    }

    // what the best move would have won
    if (best && !missedMate && reasons.length < 2) {
      const won = lineMaterial(ctx.fen, best.pv, me, 5);
      const first = won.moves[0];
      const gain = won.swing - played.swing;
      if (gain >= 2 && first?.captured) {
        reasons.push(`Mund të merrje ${PIECE[first.captured as Kind].theirsAcc} në ${first.to} me [[${first.san}]].`);
        tags.push('missed-capture');
      } else if (gain >= 2 && first) {
        const pos = new Chess(ctx.fen);
        const m = play(pos, best.pv[0]);
        const targets = m ? forkTargets(pos, m.to, them) : [];
        if (targets.length >= 2) {
          const [a, b] = targets.sort((x, y) => (y.kind === 'k' ? 99 : VALUE[y.kind]) - (x.kind === 'k' ? 99 : VALUE[x.kind]));
          reasons.push(`Me [[${first.san}]] kishe sulm të dyfishtë (pirun) mbi ${both(PIECE[a.kind].theirsAcc, PIECE[b.kind].theirsAcc)}.`);
          tags.push('missed-fork');
        }
      }
    }

    reasons.push(...openingTips(ctx.fen, move, ctx.history, tags));
    if (!reasons.some((r) => r.includes(`[[${bestSan}]]`))) reasons.push(`Më e mirë ishte [[${bestSan}]].`);
  } else {
    reasons.push(...praise(ctx.fen, move, chess, grade, ctx, me));
  }

  return {
    grade,
    symbol: GRADES[grade].symbol,
    title: GRADES[grade].title,
    reasons: reasons.slice(0, 3),
    better: bad ? { uci: bestUci, san: bestSan } : null,
    goodMoves: ctx.before.lines.filter((l) => l.pv[0] && lineScore(best) - lineScore(l) <= 30).map((l) => l.pv[0]),
    fen: ctx.fen,
    refutation: [ctx.uci, ...(reply?.pv.slice(0, 3) ?? [])],
    bestLine: best?.pv.slice(0, 4) ?? [bestUci],
    winBefore: wb,
    winAfter: wa,
    accuracy: moveAccuracy(wb, wa),
    tags,
    san: move.san,
  };
}

/** Opening habits worth a sentence, early in the game only. */
function openingTips(fen: string, move: Move, history: string[], tags: Tag[]): string[] {
  const out: string[] = [];
  const myMoves = history.filter((_, i) => i % 2 === history.length % 2);
  if (history.length > 20) return out;
  if (move.piece === 'q' && !move.captured && history.length < 12) {
    out.push('Mbretëresha doli herët: kundërshtari fiton kohë duke e sulmuar me figura më të vogla.');
    tags.push('early-queen');
  }
  if (move.piece === 'n' && (move.to[0] === 'a' || move.to[0] === 'h') && !move.captured) {
    out.push('Kali në buzë të tabelës kontrollon pak fusha.');
    tags.push('rim-knight');
  }
  if (move.piece === 'p' && move.from[0] === 'f' && history.length < 16 && !move.captured) {
    out.push('Lëvizja e ushtarit f hap diagonalen drejt mbretit tënd.');
    tags.push('f-pawn');
  }
  // the same minor piece again while others still sit at home
  if ((move.piece === 'n' || move.piece === 'b') && !move.captured) {
    const chess = new Chess(fen);
    const side = chess.turn();
    const home = side === 'w' ? ['b1', 'g1', 'c1', 'f1'] : ['b8', 'g8', 'c8', 'f8'];
    const undeveloped = home.filter((s) => {
      const p = chess.get(s as Square);
      return p && p.color === side && (p.type === 'n' || p.type === 'b');
    }).length;
    const movedBefore = myMoves.some((san) => san.replace(/[+#x]/g, '').endsWith(move.from));
    if (undeveloped >= 2 && movedBefore) {
      out.push('E lëvize të njëjtën figurë dy herë; në hapje zhvillo figura të reja.');
      tags.push('same-piece');
    }
  }
  return out.slice(0, 1);
}

/** What a good move did well. */
function praise(fen: string, move: Move, after: Chess, grade: Grade, ctx: MoveContext, me: Color): string[] {
  if (after.isCheckmate()) return ['Shah mat. Fitove!'];
  if (grade === 'forced') return ['E vetmja lëvizje e ligjshme.'];
  if (grade === 'brilliant') return ['Sakrificë që funksionon: jep material dhe pozicioni mbetet i fortë.'];
  const out: string[] = [];
  if (move.isKingsideCastle() || move.isQueensideCastle()) out.push('Rokadë: mbreti është më i sigurt dhe torra hyn në lojë.');
  if (move.captured) {
    const won = lineMaterial(fen, ctx.after.lines[0] ? [ctxUci(move), ...ctx.after.lines[0].pv] : [ctxUci(move)], me);
    if (won.swing >= 1) out.push(`Mirë: fitove ${PIECE[move.captured as Kind].one}.`);
  }
  const early = ctx.history.length < 16;
  if (early && (move.piece === 'n' || move.piece === 'b') && (move.from[1] === '1' || move.from[1] === '8') && !move.captured)
    out.push(`Zhvillim i mirë: ${PIECE[move.piece as Kind].the} del drejt qendrës.`);
  if (early && move.piece === 'p' && ['e4', 'd4', 'e5', 'd5'].includes(move.to) && !move.captured) out.push('Ushtari zë qendrën.');
  const second = ctx.before.lines[1];
  if (grade === 'best' && second && chance(ctx.before.lines[0]) - chance(second) > 0.3) out.push('E vetmja lëvizje e mirë këtu.');
  if (!out.length && after.inCheck()) out.push('Shah.');
  if (!out.length && grade === 'book') out.push('Lëvizje e njohur e hapjes.');
  if (!out.length && grade === 'best') out.push('Pikërisht lëvizja që do të luante motori.');
  if (!out.length) out.push('Lëvizje e shëndoshë.');
  return out.slice(0, 2);
}

const ctxUci = (m: Move) => m.from + m.to + (m.promotion ?? '');

// ------------------------------------------------------------------ threats

/**
 * What the opponent would do if it were their move again: a search of the position with the turn passed.
 * Returns a warning when that move wins material or mates.
 */
export function threatWarning(fen: string, a: Analysis): string | null {
  const chess = new Chess(fen);
  const victim = chess.turn() as Color;
  const line = a.lines[0];
  if (!line?.pv[0]) return null;
  const passed = passTurn(fen);
  if (!passed) return null;
  if (line.mate !== undefined && line.mate > 0) {
    const san = uciSan(passed, line.pv[0]);
    return line.mate === 1 ? `Kujdes: kundërshtari kërcënon mat me [[${san}]].` : `Kujdes: kundërshtari kërcënon mat në ${line.mate} lëvizje.`;
  }
  const res = lineMaterial(passed, line.pv, victim);
  const first = res.moves[0];
  if (res.swing <= -2 && first?.captured) {
    return `Kujdes: ${PIECE[first.captured as Kind].yours.toLowerCase()} në ${first.to} është nën sulm.`;
  }
  return null;
}

/** The same position with the other side to move, or null when that is illegal (a king in check). */
export function passTurn(fen: string): string | null {
  const chess = new Chess(fen);
  if (chess.inCheck()) return null;
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  const out = parts.join(' ');
  try {
    const test = new Chess(out);
    // the side that just "moved" must not be giving check to a king that can be taken
    return test.fen() ? out : null;
  } catch {
    return null;
  }
}

/**
 * The reasons once the opponent has answered: when the answer was the punishing move, say what happened rather
 * than what could happen.
 */
export function afterReply(v: Verdict, playedUci: string): string[] {
  if (v.refutation[1] !== playedUci) return v.reasons;
  return v.reasons.map((r) =>
    r
      .replace('kundërshtari mund ta marrë me', 'kundërshtari e mori me')
      .replace(/^Nëse kundërshtari luan (\[\[[^\]]+\]\]), humbet/, 'Pas $1 humbe')
      .replace('Kundërshtari mund të bëjë sulm të dyfishtë (pirun):', 'Kundërshtari bëri sulm të dyfishtë (pirun):'),
  );
}

/** Average accuracy of a list of verdicts. */
export function gameAccuracy(vs: Verdict[]): number | null {
  if (!vs.length) return null;
  return vs.reduce((s, v) => s + v.accuracy, 0) / vs.length;
}
