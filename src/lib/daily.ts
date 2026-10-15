// Today's puzzle: near the learner's rating, chosen by the date, so it stays the same all day. One function for the
// puzzles page and the home screen's preview, so both show the same position.

export interface DailyPick {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
}

export function pickDaily<T extends DailyPick>(all: T[], rating: number, date: string): T {
  const near = [...all].sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating)).slice(0, 60);
  let h = 0;
  for (const c of date) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return near[h % near.length];
}
