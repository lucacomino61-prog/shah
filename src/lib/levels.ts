// How strongly the engine plays. The lower levels pick among its top lines, and now and then a random move, so
// a learner can win. Each level is a character with an Albanian name (invented, nobody real) and says how it
// plays; no rating number is claimed, since none has been measured.

import type { Analysis } from './engine.ts';
import { lineScore } from './coach.ts';

export interface Level {
  n: number;
  /** the character across the table */
  bot: string;
  /** the colour of the character's initial */
  hue: string;
  name: string;
  note: string;
  /** search depth of the move choice (the coach's own search is never shallower than 12) */
  depth: number;
  movetime?: number;
  /** share of moves picked at random from all legal moves */
  random: number;
  /** weights for the engine's best, second, third... line */
  weights: number[];
  /** a line further than this many centipawns below the best is never chosen */
  cap: number;
}

export const LEVELS: Level[] = [
  { n: 1, bot: 'Agimi', hue: '#34c759', name: 'Shumë i lehtë', note: 'Gabon shpesh dhe lë figura pa mbrojtje.', depth: 12, random: 0.3, weights: [1, 1, 1, 1], cap: Infinity },
  { n: 2, bot: 'Drita', hue: '#30b0c7', name: 'I lehtë', note: 'Luan me kujdes, por bën gabime të qarta.', depth: 12, random: 0.12, weights: [0.4, 0.3, 0.2, 0.1], cap: 700 },
  { n: 3, bot: 'Besniku', hue: '#007aff', name: 'Mesatar', note: 'Rrallë lë diçka falas. Duhet të luash mirë.', depth: 12, random: 0.04, weights: [0.6, 0.25, 0.15], cap: 250 },
  { n: 4, bot: 'Teuta', hue: '#5856d6', name: 'I fortë', note: 'Zgjedh pothuajse gjithmonë një nga dy lëvizjet më të mira.', depth: 12, random: 0, weights: [0.8, 0.2], cap: 80 },
  { n: 5, bot: 'Ardiani', hue: '#af52de', name: 'Shumë i fortë', note: 'Luan lëvizjen më të mirë që gjen.', depth: 14, random: 0, weights: [1], cap: 0 },
  { n: 6, bot: 'Stockfish', hue: '#8e8e93', name: 'Motori i plotë', note: 'Stockfish me gjithë forcën që ka në shfletues.', depth: 18, movetime: 2500, random: 0, weights: [1], cap: 0 },
];

export const levelOf = (n: number) => LEVELS.find((l) => l.n === n) ?? LEVELS[1];

/** The engine's move at this level, from a search with several lines. */
export function pickMove(a: Analysis, level: Level, legal: string[], rnd: () => number = Math.random): string | null {
  if (!legal.length) return null;
  if (level.random && rnd() < level.random) return legal[Math.floor(rnd() * legal.length)];
  const lines = a.lines.filter((l) => l.pv[0]);
  if (!lines.length) return a.bestmove ?? legal[0];
  const top = lineScore(lines[0]);
  const pool = lines.slice(0, level.weights.length).filter((l) => top - lineScore(l) <= level.cap);
  // a mate on the board is always taken
  if (lines[0].mate !== undefined && lines[0].mate > 0 && level.n >= 2) return lines[0].pv[0];
  const weights = pool.map((_, i) => level.weights[i] ?? 0);
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  let r = rnd() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].pv[0];
  }
  return pool[0].pv[0];
}
