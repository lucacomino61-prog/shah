// Samples the Lichess puzzle database (CC0, mirrored on Hugging Face as Lichess/chess-puzzles) page by page and
// keeps well-rated, popular puzzles for the themes a club learner needs. Writes tools/cache/puzzle-rows.json;
// tools/build-puzzles.mjs then checks them with the engine and writes src/data/puzzles.json.
// curl, not fetch: Node's fetch drops connections to this host on this network.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheDir = join(root, 'tools', 'cache');
mkdirSync(cacheDir, { recursive: true });
const out = join(cacheDir, 'puzzle-rows.json');

const BASE = 'https://datasets-server.huggingface.co';
const DS = 'dataset=Lichess/chess-puzzles&config=default&split=train';
const get = (url) => JSON.parse(execFileSync('curl', ['-s', '-m', '60', '--retry', '3', url], { encoding: 'utf8', maxBuffer: 64 << 20 }));

const size = get(`${BASE}/size?${DS}`);
const total = size.size?.splits?.[0]?.num_rows ?? size.size?.config?.num_rows ?? 5_000_000;
const pages = Number(process.argv[2] ?? 160);
console.log(`rows in the database: ${total}; reading ${pages} pages of 100`);

const rows = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
const seen = new Set(rows.map((r) => r.PuzzleId));
// spread evenly with a fixed offset, so a rerun reads the same pages
for (let i = 0; i < pages; i++) {
  const offset = Math.floor(((i + 0.37) / pages) * (total - 100));
  try {
    const page = get(`${BASE}/rows?${DS}&offset=${offset}&length=100`);
    for (const { row } of page.rows ?? []) {
      if (seen.has(row.PuzzleId)) continue;
      seen.add(row.PuzzleId);
      if (row.Rating > 1700 || row.Popularity < 80 || row.NbPlays < 500) continue;
      rows.push({ id: row.PuzzleId, fen: row.FEN, moves: row.Moves, rating: row.Rating, rd: row.RatingDeviation, pop: row.Popularity, plays: row.NbPlays, themes: row.Themes });
    }
  } catch (e) {
    console.log(`page ${i} failed: ${e.message.split('\n')[0]}`);
  }
  if (i % 20 === 19) {
    writeFileSync(out, JSON.stringify(rows));
    console.log(`${i + 1} pages, ${rows.length} kept`);
  }
}
writeFileSync(out, JSON.stringify(rows));
console.log(`done: ${rows.length} candidate puzzles in tools/cache/puzzle-rows.json`);
