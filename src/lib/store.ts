// Progress kept in this browser only: games, puzzle rating, mistake families, lessons done, the game in progress.
// Every read and write survives a private window or blocked storage (the page then forgets on reload).

import type { Tag, Verdict } from './coach.ts';

export interface GameRecord {
  date: string;
  /** the side the learner played */
  side: 'w' | 'b';
  level: number;
  result: 'win' | 'loss' | 'draw' | 'resigned';
  moves: number;
  accuracy: number | null;
  blunders: number;
  mistakes: number;
  opening: string | null;
}

export interface Progress {
  games: GameRecord[];
  puzzleRating: number;
  puzzlesSolved: number;
  puzzlesTried: number;
  /** puzzle ids solved first time, so the same one is not dealt again soon */
  seen: string[];
  tags: Partial<Record<Tag, number>>;
  lessons: string[];
  level: number;
  side: 'w' | 'b' | 'random';
  view: '3d' | '2d';
  warnings: boolean;
  /** the game clock: 'none' or minutes+increment, e.g. '5+3' */
  clock: string;
  /** the learner's own mistakes, brought back as puzzles */
  cards: Card[];
}

/** One of the learner's mistakes, kept as a puzzle: find a good move where the bad one was played. */
export interface Card {
  id: string;
  /** the position before the mistake (the learner to move) */
  fen: string;
  /** every move that solves it (UCI) */
  good: string[];
  /** the engine's line from here, to show after */
  line: string[];
  /** what was played in the game (SAN) and how bad it was */
  played: string;
  grade: 'mistake' | 'blunder';
  reason: string;
  /** 0..4: the next wait is DAYS[box]; past 4 the card is learnt */
  box: number;
  /** YYYY-MM-DD the card is next due */
  due: string;
  made: string;
}

/** Days before a card comes back, by box. */
export const DAYS = [0, 1, 3, 7, 21];

export const today = (d = new Date()) => d.toISOString().slice(0, 10);
const addDays = (n: number) => today(new Date(Date.now() + n * 86400000));

/** Cards due today or earlier, oldest first. */
export const dueCards = (p: Progress) => p.cards.filter((c) => c.box <= 4 && c.due <= today()).sort((a, b) => a.due.localeCompare(b.due));

/** Keep a mistake from a game as a card (once per position and move). */
export function addCard(v: Verdict) {
  if (v.grade !== 'mistake' && v.grade !== 'blunder') return;
  update((p) => {
    const id = `${v.fen.split(' ').slice(0, 4).join(' ')}|${v.san}`;
    if (p.cards.some((c) => c.id === id)) return;
    p.cards.push({
      id,
      fen: v.fen,
      good: v.goodMoves.length ? v.goodMoves : v.better ? [v.better.uci] : [],
      line: v.bestLine,
      played: v.san,
      grade: v.grade as 'mistake' | 'blunder',
      reason: v.reasons[0] ?? '',
      box: 0,
      due: today(),
      made: today(),
    });
    // a long history keeps the newest 150
    p.cards = p.cards.slice(-150);
  });
}

/** A card was tried: solved first time moves it up a box, a miss sends it back to the start (due tomorrow). */
export function reviewCard(id: string, solved: boolean): Card | null {
  let out: Card | null = null;
  update((p) => {
    const c = p.cards.find((x) => x.id === id);
    if (!c) return;
    c.box = solved ? c.box + 1 : 0;
    c.due = c.box > 4 ? '9999-12-31' : addDays(solved ? DAYS[c.box] : 1);
    out = { ...c };
  });
  return out;
}

const KEY = 'shah.progress.v1';
const SAVED = 'shah.game.v1';

const fresh = (): Progress => ({
  games: [],
  puzzleRating: 900,
  puzzlesSolved: 0,
  puzzlesTried: 0,
  seen: [],
  tags: {},
  lessons: [],
  level: 2,
  side: 'w',
  view: '3d',
  warnings: true,
  clock: 'none',
  cards: [],
});

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    return fresh();
  }
}

export function save(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: progress lasts for this page only */
  }
}

export function update(fn: (p: Progress) => void): Progress {
  const p = load();
  fn(p);
  save(p);
  return p;
}

export interface SavedGame {
  fens: string[];
  sans: string[];
  ucis: string[];
  side: 'w' | 'b';
  level: number;
  verdicts: unknown[];
  /** the position's value after each move, centipawns for white */
  evals?: (number | null)[];
  clock?: { base: number; inc: number; w: number; b: number } | null;
}

export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVED);
    return raw ? (JSON.parse(raw) as SavedGame) : null;
  } catch {
    return null;
  }
}

export function saveGame(g: SavedGame | null) {
  try {
    if (g) localStorage.setItem(SAVED, JSON.stringify(g));
    else localStorage.removeItem(SAVED);
  } catch {
    /* as above */
  }
}

/** Elo-style update of the puzzle rating after a puzzle of `rating`. */
export function ratePuzzle(mine: number, rating: number, solved: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (rating - mine) / 400));
  return Math.round(mine + 28 * ((solved ? 1 : 0) - expected));
}
