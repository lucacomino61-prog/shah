// Progress kept in this browser: games, puzzle rating, mistake families, lessons done, the game in progress.
// Every read and write survives a private window or blocked storage (the page then forgets on reload). When the
// learner turns sync on, an encrypted copy also goes to the server (src/lib/sync.ts) and merges with their other phones.

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
  warnings: boolean;
  /** the Show-threats switch: a red ring round each of the learner's pieces the opponent could win next move */
  threats: boolean;
  /** move sounds (and a short vibration where the phone allows it) */
  sound: boolean;
  /** the game clock: 'none' or minutes+increment, e.g. '5+3' */
  clock: string;
  /** opening lines: correct runs in a row and tries, by repertoire slug + line index */
  reps: Record<string, { streak: number; tries: number }>;
  /** the learner's own mistakes, brought back as puzzles */
  cards: Card[];
  /** today's puzzle, the same one all day */
  daily: Daily | null;
  /** days in a row with the daily puzzle solved; last = the latest such day */
  streak: { count: number; last: string };
  /** the longest run of days the streak has reached (kept for the badges after a run ends) */
  bestStreak: number;
  /** the best score in the three-minute race */
  rushBest: number;
  /** who sits across the table: the engine, or a friend on the same phone */
  opponent: 'engine' | 'friend';
  /** when this copy last changed (ISO) */
  updated: string;
  /** when a setting (SETTINGS) last changed here (ISO): syncing keeps the settings changed last */
  settingsAt: string;
  /** when the progress was last wiped (ISO); a wipe wins over older copies on other phones */
  resetAt: string;
}

export interface Daily {
  date: string;
  id: string;
  solved: boolean;
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

/** The local date, YYYY-MM-DD: a day turns at the learner's midnight, not at UTC's. */
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (n: number) => today(new Date(Date.now() + n * 86400000));

/** The streak as it stands now: it holds while the last solved day is today or yesterday. */
export const streakNow = (p: Progress) => (p.streak.last === today() || p.streak.last === addDays(-1) ? p.streak.count : 0);

/** The daily puzzle was solved: the streak grows by a day if yesterday's was solved too, else starts again. */
export function solveDaily(id: string): Progress {
  return update((p) => {
    if (!p.daily || p.daily.id !== id || p.daily.date !== today() || p.daily.solved) return;
    p.daily.solved = true;
    const count = p.streak.last === today() ? p.streak.count : p.streak.last === addDays(-1) ? p.streak.count + 1 : 1;
    p.streak = { count, last: today() };
    p.bestStreak = Math.max(p.bestStreak ?? 0, count);
  });
}

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

export const fresh = (): Progress => ({
  games: [],
  puzzleRating: 900,
  puzzlesSolved: 0,
  puzzlesTried: 0,
  seen: [],
  tags: {},
  lessons: [],
  // a new player starts with a starter bot (Ermali, levels.ts FIRST_LEVEL)
  level: 8,
  side: 'w',
  warnings: true,
  threats: true,
  sound: true,
  clock: 'none',
  reps: {},
  cards: [],
  daily: null,
  streak: { count: 0, last: '' },
  bestStreak: 0,
  rushBest: 0,
  opponent: 'engine',
  updated: '',
  settingsAt: '',
  resetAt: '',
});

/** the fields that are choices rather than history: sync keeps whichever phone changed them last */
export const SETTINGS = ['level', 'side', 'warnings', 'threats', 'sound', 'clock', 'opponent'] as const;

export function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    return { ...fresh(), ...JSON.parse(raw) };
  } catch {
    return fresh();
  }
}

/** Keeps the progress; `touch` marks it changed here (a copy merged in from another phone is not a change). */
export function save(p: Progress, touch = true) {
  if (touch) {
    const now = new Date().toISOString();
    const before = load();
    if (SETTINGS.some((k) => before[k] !== p[k])) p.settingsAt = now;
    p.updated = now;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: progress lasts for this page only */
  }
  // the sync (when it is on) sends the change to the other phones a little later
  if (touch && typeof window !== 'undefined') window.dispatchEvent(new Event('shah:saved'));
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
  /** two people on one phone: side is whoever moves next */
  friend?: boolean;
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
