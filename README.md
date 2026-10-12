# Shah

An Albanian chess coach. You play Stockfish at a strength you can beat. After every move the coach grades it,
says why in plain Albanian, and can replay the better line on the board ("Shiko pse"). There are also Lichess
puzzles and seven short lessons. Everything runs in the browser: no account, no server, no cost.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:3770
npm run build      # static site in dist/
npm run preview    # http://127.0.0.1:3771
```

## Checks

```bash
npm test                         # the coach's grades and sentences, against the real engine
node tools/check-lessons.ts      # every lesson position and answer, against the engine
node tools/shots.mjs             # screenshots of every page in headless Chrome (dev server running)
```

## Where things are

- `src/lib/coach.ts`: grading (win-chance loss, Lichess thresholds) and the Albanian explanations.
- `src/lib/engine.ts`: Stockfish in a Web Worker, spoken to in UCI.
- `src/lib/levels.ts`: the six strengths. The weak ones pick worse lines on purpose.
- `src/scripts/board/board3d.ts`: the wooden board in three.js (camera angles, arrows, the replay).
- `src/scripts/board/board2d.ts`: the flat board.
- `src/data/puzzles.json`: 246 puzzles from the Lichess database (CC0), rebuilt with `tools/fetch-puzzles.mjs` and
  `tools/build-puzzles.mjs`, each solution checked with the engine.
- `src/data/lessons.ts`: the lessons.

## Licences

- Stockfish.js (`public/engine/`) is GPL-3.0; its licence is in `public/engine/COPYING.txt`. If the app is ever
  published, its source must be offered too.
- Puzzle data: Lichess puzzle database, CC0.
- Mona Sans: SIL Open Font License. Phosphor icons: MIT. chess.js: BSD-2-Clause. three.js: MIT.
