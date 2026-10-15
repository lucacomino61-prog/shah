// Two copies of the progress made one, for sync between phones. Every field joins the same way whichever copy comes
// first and however often it is repeated (lists are unions in a fixed order, counts take the larger, a later date
// wins), so two phones that have exchanged copies agree and stop sending. A wipe is the exception: the copy wiped
// last wins whole.

import { SETTINGS, type Card, type GameRecord, type Progress } from './store.ts';

/** JSON with sorted keys: the same content always gives the same text. */
export function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

const pick = <T extends object, K extends keyof T>(o: T, keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<T, K>;
const gameKey = (g: GameRecord) => `${g.date}|${g.side}|${g.level}|${g.moves}|${g.result}`;
const sortedUnion = (a: string[], b: string[]) => [...new Set([...a, ...b])].sort();
/** the larger of two, by a list of comparisons in turn, then by their text */
function larger<T>(a: T, b: T, ...keys: ((x: T) => number | string)[]): T {
  for (const k of keys) {
    const x = k(a);
    const y = k(b);
    if (x !== y) return x > y ? a : b;
  }
  return canon(a) >= canon(b) ? a : b;
}

export function merge(a: Progress, b: Progress): Progress {
  if (a.resetAt !== b.resetAt) return a.resetAt > b.resetAt ? a : b;
  // the settings of whichever phone changed a setting last (not just played last)
  const newer = larger(a, b, (p) => p.settingsAt, (p) => canon(pick(p, SETTINGS)));

  const games = new Map<string, GameRecord>();
  for (const g of [...a.games, ...b.games]) {
    const k = gameKey(g);
    const had = games.get(k);
    games.set(k, had ? larger(had, g) : g);
  }

  const cards = new Map<string, Card>();
  for (const c of [...a.cards, ...b.cards]) {
    const had = cards.get(c.id);
    // the card further along wins: a later due date, then a higher box
    cards.set(c.id, had ? larger(had, c, (x) => x.due, (x) => x.box) : c);
  }

  const tags: Progress['tags'] = { ...a.tags };
  for (const [k, n] of Object.entries(b.tags) as [keyof Progress['tags'], number][]) tags[k] = Math.max(tags[k] ?? 0, n);

  const reps: Progress['reps'] = { ...a.reps };
  for (const [k, r] of Object.entries(b.reps)) reps[k] = reps[k] ? larger(reps[k], r, (x) => x.tries, (x) => x.streak) : r;

  const puzzles = larger(a, b, (p) => p.puzzlesTried, (p) => p.puzzlesSolved, (p) => p.puzzleRating);
  const daily = !a.daily || !b.daily ? (a.daily ?? b.daily) : larger(a.daily, b.daily, (d) => d.date, (d) => (d.solved ? 1 : 0), (d) => d.id);
  const streak = larger(a.streak, b.streak, (s) => s.last, (s) => s.count);

  return {
    ...newer,
    ...pick(newer, SETTINGS),
    games: [...games.values()].sort((x, y) => x.date.localeCompare(y.date) || gameKey(x).localeCompare(gameKey(y))),
    puzzleRating: puzzles.puzzleRating,
    puzzlesSolved: puzzles.puzzlesSolved,
    puzzlesTried: puzzles.puzzlesTried,
    seen: sortedUnion(a.seen, b.seen),
    tags,
    lessons: sortedUnion(a.lessons, b.lessons),
    reps,
    cards: [...cards.values()].sort((x, y) => x.made.localeCompare(y.made) || x.id.localeCompare(y.id)).slice(-150),
    daily: daily ? { ...daily } : null,
    streak: { ...streak },
    rushBest: Math.max(a.rushBest, b.rushBest),
    bestStreak: Math.max(a.bestStreak ?? 0, b.bestStreak ?? 0, streak.count),
    updated: a.updated > b.updated ? a.updated : b.updated,
    settingsAt: newer.settingsAt,
    resetAt: a.resetAt,
  };
}
