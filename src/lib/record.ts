// What the learner has done, counted from the progress itself: the record against each opponent, accuracy over
// the games, and the badges. A badge is earned only by something the progress shows; nothing here is estimated.

import { LESSONS } from '../data/lessons.ts';
import { REPERTOIRES } from '../data/repertoires.ts';
import type { IconName } from './icons.ts';
import { LEVELS, levelOf } from './levels.ts';
import type { GameRecord, Progress } from './store.ts';

export interface Score {
  won: number;
  drawn: number;
  lost: number;
}

const tally = (games: GameRecord[]): Score => ({
  won: games.filter((g) => g.result === 'win').length,
  drawn: games.filter((g) => g.result === 'draw').length,
  // a game the learner resigned is a loss too
  lost: games.filter((g) => g.result === 'loss' || g.result === 'resigned').length,
});

/** The learner's score against one opponent (a level id). */
export const scoreVs = (p: Progress, id: number): Score => tally(p.games.filter((g) => g.level === id));

/** Every opponent in the order they are met, with the learner's score against each. */
export const scores = (p: Progress) => LEVELS.map((l) => ({ level: l, score: scoreVs(p, l.id) }));

/** "2 – 1 – 0" read as words, for screen readers and short lines. */
export function scoreWords(s: Score): string {
  const n = s.won + s.drawn + s.lost;
  if (!n) return 'Ende pa lojë';
  const part = (k: number, one: string, many: string) => (k === 1 ? `1 ${one}` : `${k} ${many}`);
  return [part(s.won, 'fitore', 'fitore'), s.drawn ? part(s.drawn, 'barazim', 'barazime') : '', part(s.lost, 'humbje', 'humbje')].filter(Boolean).join(', ');
}

/** The accuracy of the last games that have one, oldest first. */
export const accuracies = (p: Progress, last = 20) =>
  p.games
    .filter((g) => g.accuracy !== null)
    .slice(-last)
    .map((g) => ({ accuracy: g.accuracy as number, result: g.result, bot: levelOf(g.level).bot, date: g.date }));

export interface Badge {
  id: string;
  title: string;
  /** how it is earned, in one short line */
  how: string;
  earned: boolean;
  /** how far along, when it counts something: [done, needed] */
  progress?: [number, number];
  /** the symbol struck into the medal */
  icon: IconName;
}

const longGame = (g: GameRecord) => g.moves >= 20;

export function badges(p: Progress): Badge[] {
  const wins = p.games.filter((g) => g.result === 'win');
  const beaten = new Set(wins.map((g) => levelOf(g.level).n));
  const bestStreak = Math.max(p.bestStreak ?? 0, p.streak.count);
  const learntCards = p.cards.filter((c) => c.box > 4).length;
  const learntLines = REPERTOIRES.reduce((n, r) => n + r.lines.filter((_, i) => (p.reps[`${r.slug}:${i}`]?.streak ?? 0) >= 3).length, 0);
  const lessonsDone = LESSONS.filter((l) => p.lessons.includes(l.slug)).length;
  const count = (id: string, icon: IconName, title: string, how: string, done: number, needed: number): Badge => ({ id, icon, title, how, earned: done >= needed, progress: [Math.min(done, needed), needed] });
  return [
    { id: 'first-win', icon: 'trophy', title: 'Fitorja e parë', how: 'Fito një lojë kundër cilitdo.', earned: wins.length > 0 },
    { id: 'past-starters', icon: 'crownSimple', title: 'Përtej fillestarëve', how: 'Fito kundër Agimit ose dikujt më të fortë.', earned: [...beaten].some((n) => n >= 4) },
    { id: 'clean', icon: 'shieldCheck', title: 'Pa gabim të rëndë', how: 'Një lojë prej 20 lëvizjesh pa asnjë gabim të rëndë.', earned: p.games.some((g) => longGame(g) && g.blunders === 0) },
    { id: 'sharp', icon: 'target', title: 'Saktësi 90%', how: 'Një lojë prej 20 lëvizjesh me saktësi 90% ose më shumë.', earned: p.games.some((g) => longGame(g) && (g.accuracy ?? 0) >= 90) },
    count('puzzles-10', 'puzzleFill', '10 ushtrime', 'Zgjidh 10 ushtrime pa ndihmë.', p.puzzlesSolved, 10),
    count('puzzles-50', 'puzzleFill', '50 ushtrime', 'Zgjidh 50 ushtrime pa ndihmë.', p.puzzlesSolved, 50),
    count('streak-3', 'fire', '3 ditë rresht', 'Zgjidh ushtrimin e ditës 3 ditë rresht.', bestStreak, 3),
    count('streak-7', 'calendarFill', 'Një javë', 'Zgjidh ushtrimin e ditës 7 ditë rresht.', bestStreak, 7),
    count('lesson-1', 'bookOpen', 'Mësimi i parë', 'Mbaro një mësim.', lessonsDone, 1),
    count('lessons-all', 'graduationCap', 'Kursi i plotë', `Mbaro të ${LESSONS.length} mësimet.`, lessonsDone, LESSONS.length),
    count('cards-5', 'sealCheck', 'Gabime të mësuara', 'Zgjidh 5 nga gabimet e tua aq herë sa të mos kthehen më.', learntCards, 5),
    count('line-1', 'key', 'Hapja e parë', 'Mëso një linjë hapjeje përmendsh (3 herë rresht pa gabim).', learntLines, 1),
  ];
}
