# Shah

An Albanian chess coach. You play Stockfish at a strength you can beat. After every move the coach grades it,
says why in plain Albanian, and can replay the better line on the board ("Shiko pse"). Your own mistakes come back
as spaced puzzles; there are also Lichess puzzles, eight short lessons (the last one played out against the
engine), an opening trainer for three repertoires, a clock and a graph of every game. Everything runs in the
browser: no account, no server, no cost. It installs as an app and works offline.

Live: https://shah-trajneri.pages.dev

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:3770
npm run build        # static site in dist/, then the service worker, sitemap and robots.txt
npm run preview      # http://127.0.0.1:3771
npm run preview:lan  # http://<this computer's address>:3772, to try it on a phone on the same Wi-Fi
```

## Checks

```bash
npm test                                  # the coach's grades and sentences, against the real engine
node tools/check-lessons.ts               # every lesson position and answer, against the engine
node tools/check-repertoires.ts           # every repertoire move, against the engine
node tools/test-taps.mjs                  # tapping and dragging on both boards (dev server running)
node tools/test-flow.mjs                  # clock, blunder, graph, the blunder back as a puzzle (dev server)
node tools/test-trainer.mjs               # opening trainer and the endgame play-out (dev server)
node tools/test-offline.mjs [url]         # installed app offline (production preview or the live site)
node tools/shots.mjs                      # screenshots of every page in headless Chrome (dev server running)
```

## Deploy

Cloudflare Pages, project `shah-trajneri`, production branch `master`:

```bash
npm run build
npx wrangler pages deploy dist --project-name shah-trajneri --branch master
```

## Where things are

- `src/lib/coach.ts`: grading (win-chance loss, Lichess thresholds) and the Albanian explanations.
- `src/lib/engine.ts`: Stockfish in a Web Worker, spoken to in UCI.
- `src/lib/levels.ts`: the six strengths. The weak ones pick worse lines on purpose.
- `src/lib/store.ts`: progress in localStorage, the spaced-repetition cards of your own mistakes.
- `src/scripts/board/board3d.ts`: the wooden board in three.js (camera angles, arrows, the replay).
- `src/scripts/board/board2d.ts`: the flat board.
- `src/scripts/trainer.ts` and `src/data/repertoires.ts`: the opening trainer and its lines.
- `src/data/puzzles.json`: 246 puzzles from the Lichess database (CC0), rebuilt with `tools/fetch-puzzles.mjs` and
  `tools/build-puzzles.mjs`, each solution checked with the engine.
- `src/data/lessons.ts`: the lessons.
- `tools/postbuild.mjs`: the service worker (every built file precached), sitemap and robots.txt.
- `docs/SHQIP.md`: the Albanian terms and sentences, for a native speaker to check.

## Licences

- This app: GPL-3.0-or-later (`LICENSE`), because it ships Stockfish.
- Stockfish.js (`public/engine/`): GPL-3.0; its licence is in `public/engine/COPYING.txt`.
- Puzzle data: Lichess puzzle database, CC0.
- Mona Sans: SIL Open Font License. Phosphor icons: MIT. chess.js: BSD-2-Clause. three.js: MIT. GSAP: its own
  standard licence (free).
