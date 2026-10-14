// Picks the puzzles the app deals (ten themes a club learner needs, rated 400 to 1700) from the rows that
// fetch-puzzles.mjs sampled, checks each solution with the engine, and writes src/data/puzzles.json.
// Lichess puzzle data is CC0: https://database.lichess.org/#puzzles
import { Chess } from 'chess.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startEngine } from './sf.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = JSON.parse(readFileSync(join(root, 'tools', 'cache', 'puzzle-rows.json'), 'utf8'));

// the order decides a puzzle's main theme when it has several
const THEMES = ['mateIn1', 'backRankMate', 'mateIn2', 'fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece', 'trappedPiece', 'promotion'];
// node tools/build-puzzles.mjs [per-theme]: up to this many per theme (a rare theme gives what the sample holds)
const PER_THEME = Number(process.argv[2] ?? 200);

const picked = new Map();
for (const theme of THEMES) {
  const pool = rows
    .filter((r) => r.themes.includes(theme) && r.rating >= 400 && r.rating <= 1700 && r.rd <= 95 && !picked.has(r.id))
    .sort((a, b) => b.pop * Math.log(b.plays) - a.pop * Math.log(a.plays));
  // spread over the rating range: take from each band in turn
  const bands = [[400, 900], [900, 1200], [1200, 1450], [1450, 1700]].map(([lo, hi]) => pool.filter((r) => r.rating >= lo && r.rating < hi));
  const take = [];
  for (let i = 0; take.length < PER_THEME && bands.some((b) => b.length > i); i++) for (const b of bands) if (b[i] && take.length < PER_THEME) take.push(b[i]);
  for (const r of take) picked.set(r.id, { ...r, theme });
}
console.log(`candidates: ${picked.size}`);

const sf = startEngine();
const out = [];
let dropped = 0;
for (const p of picked.values()) {
  const moves = p.moves.split(' ');
  const chess = new Chess(p.fen);
  try {
    for (const u of moves) chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || undefined });
  } catch {
    dropped++;
    continue;
  }
  // the position the learner sees: after the opponent's last move
  const start = new Chess(p.fen);
  start.move({ from: moves[0].slice(0, 2), to: moves[0].slice(2, 4), promotion: moves[0][4] || undefined });
  const a = await sf.analyse(start.fen(), { depth: 13 });
  const best = a.bestmove;
  const line = a.lines[0];
  const ok = best === moves[1] || (line?.mate !== undefined && line.mate > 0 && p.themes.some((t) => t.startsWith('mateIn')));
  if (!ok) {
    dropped++;
    continue;
  }
  out.push({ id: p.id, fen: p.fen, moves, rating: p.rating, theme: p.theme, themes: p.themes.filter((t) => THEMES.includes(t)) });
}
sf.quit();
out.sort((a, b) => a.rating - b.rating);
writeFileSync(join(root, 'src', 'data', 'puzzles.json'), JSON.stringify(out));
// the lessons' practice steps take the easiest of a theme: they get their own small file, so the pages that only
// list the lessons do not carry the whole puzzle set
const forLessons = THEMES.flatMap((t) => out.filter((p) => p.theme === t).slice(0, 12));
writeFileSync(join(root, 'src', 'data', 'lesson-puzzles.json'), JSON.stringify(forLessons));
const count = {};
for (const p of out) count[p.theme] = (count[p.theme] ?? 0) + 1;
console.log(`kept ${out.length}, dropped ${dropped}`, count);
process.exit(0);
