// How strongly the opponent plays, and how it plays like a person (Luca, 2026-10-15: "make more starter levels bcs
// they are very hard for some1 that dose not know and make the bot to act more like a human"). Each level is a
// character with an Albanian name (invented, nobody real) and says how it plays; no rating number is claimed, since
// none has been measured.
//
// The three starter bots do not use the engine to choose: they play from a person's eye (human.ts), seeing a loose
// piece and grabbing it, often missing that their own piece can be taken. From Agimi up the bots play the engine's
// lines, choosing among them as a person does (the best most often, a close second sometimes, rarely a worse one) and
// now and then slipping the way a person slips, with a natural-looking move the eye likes. None plays a move at
// random. Each also takes a person's time: quick on an obvious recapture, longer when the position is sharp.
//
// `id` is what the progress keeps (the six first bots kept theirs when the starters came, so saved games still name
// the right one); `n` is the level shown.

import type { Analysis } from './engine.ts';
import { lineScore } from './coach.ts';
import { humanMove, type Eye } from './human.ts';

export interface Level {
  /** kept in the progress and saved games */
  id: number;
  /** the level shown, 1 the easiest */
  n: number;
  /** the character across the table */
  bot: string;
  /** the colour of the character's initial */
  hue: string;
  name: string;
  note: string;
  /** search depth for the engine's lines (the coach's own search is never shallower than 12) */
  depth: number;
  movetime?: number;
  /** a person's eye: the starters play from it alone; the others take it for their slips */
  eye?: Eye;
  /** engine levels: how many of its lines to weigh, and how far a line may fall behind the best and still be chosen
   *  (centipawns of difference that make a line e times less likely) */
  lines: number;
  temper: number;
  /** share of moves where the eye's choice is played instead of the engine's (a person's slip) */
  slip: number;
  /** chance to see the engine's mate in one */
  mate: number;
  /** a person's time to move, milliseconds: the usual and the longest */
  think: [number, number];
}

const EYES = {
  // just learned how the pieces move
  first: {
    safety: 0.12,
    threats: 0.1,
    greed: 0.55,
    mate: 0.25,
    defend: 0,
    style: { check: 0.35, develop: 0.15, centre: 0.2, castle: 0.1, queen: 0.35, push: 0.15 },
    noise: 1.0,
  },
  // takes what is given, sees little danger
  greedy: {
    safety: 0.35,
    threats: 0.3,
    greed: 0.85,
    mate: 0.6,
    defend: 0.2,
    style: { check: 0.25, develop: 0.3, centre: 0.3, castle: 0.3, queen: 0.1, push: 0.1 },
    noise: 0.7,
  },
  // defends more often, still misses things
  learning: {
    safety: 0.7,
    threats: 0.6,
    greed: 0.95,
    mate: 0.85,
    defend: 0.5,
    style: { check: 0.15, develop: 0.4, centre: 0.35, castle: 0.5, queen: -0.25, push: 0.05 },
    noise: 0.45,
  },
  // a club player's slip: a natural move that misses one thing
  club: {
    safety: 0.85,
    threats: 0.75,
    greed: 1,
    mate: 1,
    defend: 0.8,
    style: { check: 0.1, develop: 0.4, centre: 0.3, castle: 0.5, queen: -0.3, push: 0.05 },
    noise: 0.35,
  },
} satisfies Record<string, Eye>;

export const LEVELS: Level[] = [
  {
    id: 7,
    n: 1,
    bot: 'Lea',
    hue: '#b8860b',
    name: 'Për fillestarë të plotë',
    note: 'Sapo mësoi lëvizjet. Lë figura pa mbrojtje dhe shpesh harron të marrë.',
    depth: 12,
    eye: EYES.first,
    lines: 1,
    temper: 0,
    slip: 1,
    mate: 0.25,
    think: [900, 2200],
  },
  {
    id: 8,
    n: 2,
    bot: 'Ermali',
    hue: '#d35400',
    name: 'Për fillestarë',
    note: 'Merr çdo figurë që i jep, por rrallë sheh rrezikun për të vetat.',
    depth: 12,
    eye: EYES.greedy,
    lines: 1,
    temper: 0,
    slip: 1,
    mate: 0.6,
    think: [1100, 2600],
  },
  {
    id: 9,
    n: 3,
    bot: 'Arta',
    hue: '#d81b60',
    name: 'Shumë i lehtë',
    note: 'Mbron figurat më shpesh dhe të ndëshkon kur lë diçka pa mbrojtje.',
    depth: 12,
    eye: EYES.learning,
    lines: 1,
    temper: 0,
    slip: 1,
    mate: 0.85,
    think: [1300, 3000],
  },
  { id: 1, n: 4, bot: 'Agimi', hue: '#34c759', name: 'I lehtë', note: 'Luan si fillestar që di parimet, por gabon kur loja ndërlikohet.', depth: 12, eye: EYES.learning, lines: 6, temper: 130, slip: 0.14, mate: 0.9, think: [1500, 3400] },
  { id: 2, n: 5, bot: 'Drita', hue: '#30b0c7', name: 'Mesatarisht i lehtë', note: 'Luan me kujdes, por bën gabime të qarta.', depth: 12, eye: EYES.club, lines: 5, temper: 75, slip: 0.07, mate: 1, think: [1700, 3800] },
  { id: 3, n: 6, bot: 'Besniku', hue: '#007aff', name: 'Mesatar', note: 'Rrallë lë diçka falas. Duhet të luash mirë.', depth: 12, eye: EYES.club, lines: 4, temper: 40, slip: 0.03, mate: 1, think: [1900, 4200] },
  { id: 4, n: 7, bot: 'Teuta', hue: '#5856d6', name: 'I fortë', note: 'Zgjedh pothuajse gjithmonë një nga lëvizjet më të mira.', depth: 12, eye: EYES.club, lines: 3, temper: 18, slip: 0.01, mate: 1, think: [2000, 4400] },
  { id: 5, n: 8, bot: 'Ardiani', hue: '#af52de', name: 'Shumë i fortë', note: 'Luan lëvizjen më të mirë që gjen.', depth: 14, lines: 1, temper: 0, slip: 0, mate: 1, think: [1800, 4000] },
  { id: 6, n: 9, bot: 'Stockfish', hue: '#8e8e93', name: 'Motori i plotë', note: 'Stockfish me gjithë forcën që ka në shfletues.', depth: 18, movetime: 2500, lines: 1, temper: 0, slip: 0, mate: 1, think: [600, 1200] },
];

/** The level a stored id names (an unknown one, from an older copy, falls back to the second starter). */
export const levelOf = (id: number) => LEVELS.find((l) => l.id === id) ?? LEVELS[1];

/** The level a new player starts on: the second starter. */
export const FIRST_LEVEL = 8;

/** Does this level choose its moves from the engine's lines (and so need them)? */
export const usesEngine = (l: Level) => !l.eye || l.slip < 1;

/** The bot's move at this level in the position `fen`, from the engine's search with `lines` lines. */
export function pickMove(a: Analysis, level: Level, fen: string, legal: string[], rnd: () => number = Math.random): string | null {
  if (!legal.length) return null;
  const lines = a.lines.filter((l) => l.pv[0] && legal.includes(l.pv[0]));
  // a mate on the board: seen, or not
  if (lines[0]?.mate !== undefined && lines[0].mate > 0 && lines[0].mate <= 1 && rnd() < level.mate) return lines[0].pv[0];
  // a person's eye: the starters always, the others when they slip
  if (level.eye && rnd() < level.slip) {
    const m = humanMove(fen, level.eye, rnd);
    if (m && legal.includes(m)) return m;
  }
  if (!lines.length) return a.bestmove && legal.includes(a.bestmove) ? a.bestmove : legal[0];
  if (lines.length === 1 || !level.temper) return lines[0].pv[0];
  // among the engine's lines as a person chooses: the best most often, a close one sometimes, a poor one rarely
  const top = lineScore(lines[0]);
  const pool = lines.slice(0, level.lines);
  const weights = pool.map((l) => Math.exp(-Math.max(0, top - lineScore(l)) / level.temper));
  const sum = weights.reduce((s, w) => s + w, 0);
  let r = rnd() * sum;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i].pv[0];
  }
  return pool[0].pv[0];
}

/**
 * How long a person at this level takes over this move, in milliseconds: quick with one legal move, an obvious
 * recapture or in the first moves of the game; longer when several moves are close (the engine's lines say so);
 * always a little different.
 */
export function thinkTime(level: Level, a: Analysis | null, legalCount: number, ply: number, recapture: boolean, rnd: () => number = Math.random): number {
  const [usual, longest] = level.think;
  if (legalCount <= 1) return 450 + rnd() * 250;
  let t = usual;
  if (ply < 6) t *= 0.45;
  else if (ply < 14) t *= 0.75;
  if (recapture) t *= 0.45;
  // several moves about as good: a harder choice
  if (a && a.lines.length > 1) {
    const top = lineScore(a.lines[0]);
    const close = a.lines.filter((l) => top - lineScore(l) < 60).length;
    t *= 0.7 + 0.22 * close;
  }
  // a person's rhythm: never the same twice
  const u = Math.max(1e-9, rnd());
  t *= Math.exp(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) * 0.3);
  return Math.max(450, Math.min(longest, t));
}
