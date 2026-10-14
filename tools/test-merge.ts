// The sync merge (src/lib/merge.ts): two phones' progress joined into one. The same answer whichever copy comes
// first, nothing changes when a copy is merged twice (so two phones that have swapped copies stop sending), lists
// are joined, counts take the larger, the newer phone's settings win, and the copy wiped last wins whole.
// node --experimental-strip-types tools/test-merge.ts
import { canon, merge } from '../src/lib/merge.ts';
import { fresh, type Card, type GameRecord, type Progress } from '../src/lib/store.ts';

let failed = 0;
const ok = (c: boolean, label: string, extra = '') => {
  if (!c) failed++;
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}${extra ? `  | ${extra}` : ''}`);
};

const game = (date: string, result: GameRecord['result'] = 'win'): GameRecord => ({ date, side: 'w', level: 2, result, moves: 30, accuracy: 80, blunders: 0, mistakes: 1, opening: null });
const card = (id: string, box: number, due: string, made = '2026-10-01'): Card => ({ id, fen: '8/8/8/8/8/8/8/8 w - - 0 1', good: [], line: [], played: 'e4', grade: 'mistake', reason: '', box, due, made });

const a: Progress = {
  ...fresh(),
  games: [game('2026-10-10T10:00:00.000Z'), game('2026-10-11T10:00:00.000Z', 'loss')],
  puzzleRating: 1040,
  puzzlesSolved: 30,
  puzzlesTried: 41,
  seen: ['p1', 'p2'],
  tags: { hanging: 3, 'missed-fork': 1 },
  lessons: ['piruni'],
  level: 3,
  sound: false,
  reps: { italiane: { streak: 2, tries: 5 } },
  cards: [card('c1', 2, '2026-10-20'), card('c2', 0, '2026-10-14')],
  daily: { date: '2026-10-14', id: 'd1', solved: false },
  streak: { count: 4, last: '2026-10-13' },
  rushBest: 12,
  updated: '2026-10-14T08:00:00.000Z',
  settingsAt: '2026-10-13T08:00:00.000Z',
};
const b: Progress = {
  ...fresh(),
  games: [game('2026-10-11T10:00:00.000Z', 'loss'), game('2026-10-12T18:00:00.000Z', 'draw')],
  puzzleRating: 990,
  puzzlesSolved: 12,
  puzzlesTried: 20,
  seen: ['p2', 'p9'],
  tags: { hanging: 1, 'allowed-mate': 2 },
  lessons: ['lidhja', 'piruni'],
  level: 5,
  sound: true,
  reps: { italiane: { streak: 0, tries: 7 }, londra: { streak: 1, tries: 1 } },
  cards: [card('c1', 0, '2026-10-15'), card('c3', 1, '2026-10-16', '2026-10-05')],
  daily: { date: '2026-10-14', id: 'd1', solved: true },
  streak: { count: 5, last: '2026-10-14' },
  rushBest: 9,
  updated: '2026-10-14T09:30:00.000Z',
  settingsAt: '2026-10-14T09:00:00.000Z',
};

const m = merge(a, b);
ok(canon(m) === canon(merge(b, a)), 'the same answer whichever copy comes first');
ok(canon(merge(m, a)) === canon(m) && canon(merge(b, m)) === canon(m) && canon(merge(m, m)) === canon(m), 'merging a copy already merged changes nothing');
ok(m.games.length === 3 && m.games.map((g) => g.result).join(',') === 'win,loss,draw', 'games: each once, in date order', m.games.map((g) => g.date.slice(0, 10)).join(' '));
ok(m.puzzleRating === 1040 && m.puzzlesTried === 41 && m.puzzlesSolved === 30, 'puzzles: the rating of the phone that solved more');
ok(m.seen.join(',') === 'p1,p2,p9' && m.lessons.join(',') === 'lidhja,piruni', 'seen puzzles and lessons done are joined');
ok(m.tags.hanging === 3 && m.tags['missed-fork'] === 1 && m.tags['allowed-mate'] === 2, 'mistake counts take the larger of each');
ok(m.reps.italiane.tries === 7 && m.reps.londra.tries === 1, 'opening lines: the record with more tries');
const c1 = m.cards.find((c) => c.id === 'c1')!;
ok(m.cards.length === 3 && c1.box === 2 && c1.due === '2026-10-20', 'mistake cards joined; the one further along wins');
ok(m.daily!.solved === true && m.streak.count === 5 && m.streak.last === '2026-10-14', 'today’s puzzle solved on either phone counts, and the latest streak');
ok(m.rushBest === 12, 'the race record is the best of both');
ok(m.level === 5 && m.sound === true, 'settings from the phone where a setting changed last');
// playing on a phone does not make its settings newer: B changed the sound at 9:00, A only solved puzzles at 10:00
const played = merge({ ...a, updated: '2026-10-14T10:00:00.000Z' }, b);
ok(played.sound === true && played.level === 5 && played.updated === '2026-10-14T10:00:00.000Z', 'playing later on another phone does not undo a setting');
ok(m.updated === b.updated, 'the merged copy carries the newer time');

// the same time on both: still one answer
const tie = merge({ ...a, settingsAt: 'x' }, { ...b, settingsAt: 'x' });
ok(canon(tie) === canon(merge({ ...b, settingsAt: 'x' }, { ...a, settingsAt: 'x' })), 'a tie in time still gives one answer');

// a wipe on one phone reaches the other: the copy wiped last wins whole
const wiped: Progress = { ...fresh(), resetAt: '2026-10-14T10:00:00.000Z', updated: '2026-10-14T10:00:00.000Z', level: 1 };
ok(canon(merge(a, wiped)) === canon(wiped) && canon(merge(wiped, b)) === canon(wiped), 'the progress wiped last wins whole');

// many cards: the newest 150 stay, the same 150 however they arrive
const many = (from: number) => ({ ...fresh(), cards: Array.from({ length: 120 }, (_, i) => card(`k${from + i}`, 0, '2026-10-14', `2026-${String(1 + Math.floor((from + i) / 28)).padStart(2, '0')}-${String(1 + ((from + i) % 28)).padStart(2, '0')}`)) });
const x = many(0);
const y = many(100);
const xy = merge(x, y);
ok(xy.cards.length === 150 && canon(merge(xy, x)) === canon(xy) && canon(xy) === canon(merge(y, x)), 'mistake cards stay at the newest 150, the same either way');

console.log(failed ? `\n${failed} FAILED` : '\nthe merge holds');
process.exit(failed ? 1 : 0);
