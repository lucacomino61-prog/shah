// Progress kept in this browser only: games, puzzle rating, mistake families, lessons done, the game in progress.
// Every read and write survives a private window or blocked storage (the page then forgets on reload).

import type { Tag } from './coach.ts';

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
