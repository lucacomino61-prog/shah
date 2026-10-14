# Shah

An Albanian chess coach. You play Stockfish at a strength you can beat, against six named bots. After every move the
coach grades it, says why in plain Albanian, and can replay the better line on the board ("Shiko pse"). Your own
mistakes come back as spaced puzzles. There are also 1,120 Lichess puzzles with a puzzle of the day, a streak and a
three-minute race, eleven short lessons, and an opening trainer for five repertoires. The analysis board reviews any
game, including your recent chess.com or Lichess games. You can play a friend on the same phone, or online, each on
their own phone. The engine and the coach run in the browser: no account and no cost. It installs as an app and works
offline.

A small server (`server/`, a Cloudflare Worker) carries only what needs more than one phone:

- the online games;
- sync between your phones, encrypted on the phone so the server cannot read it;
- the daily reminder.

Live: https://shah-trajneri.pages.dev (server: https://shah-server.lucacomino-old.workers.dev)

## Run

```bash
npm install
npm run dev          # http://127.0.0.1:3770
npm run server       # the server on http://127.0.0.1:8787 (online games, sync, reminders); its secrets in server/.dev.vars
npm run build        # static site in dist/, then the service worker, sitemap and robots.txt
npm run preview      # http://127.0.0.1:3771
npm run preview:lan  # http://<this computer's address>:3772, to try it on a phone on the same Wi-Fi
```

In development the app finds the server at 127.0.0.1:8787. A build needs `PUBLIC_SHAH_SERVER` (the Worker's URL);
without it, the online game, sync and the reminder stay hidden.

`server/.dev.vars` is not in git. It holds:

- `VAPID_PRIVATE`: the private half of the key in `wrangler.jsonc`;
- `PUSH_LOCAL=1`: lets the tests use a local stand-in push service;
- `TEST_CLOCKS=1`: a 6-second clock for the tests.

## Checks

```bash
npm test                                  # the coach's grades and sentences, against the real engine
node tools/check-lessons.ts               # every lesson position and answer, against the engine
node tools/check-repertoires.ts           # every repertoire move, against the engine
node --experimental-strip-types tools/test-threats.ts   # the pieces-in-danger rule
node --experimental-strip-types tools/test-merge.ts     # how sync joins two phones' progress
node tools/test-taps.mjs                  # tapping and dragging on both boards (dev server running)
node tools/test-flow.mjs                  # clock, blunder, graph, the blunder back as a puzzle (dev server)
node tools/test-trainer.mjs               # opening trainer and the endgame play-out (dev server)
node tools/test-extras.mjs                # threats, sounds, puzzle of the day, race, backup, bots, two on one phone (dev)
node tools/test-analyse.mjs               # the analysis board and game review (dev server)
node tools/test-animations.mjs            # the box opening, the fallen king, the promotion, captured pieces, the streak (dev)
npm run server:check                      # the server's types (generates server/worker-configuration.d.ts first)
node tools/test-server.mjs                # the server alone: rooms, clocks, sync vault, reminders (npm run server)
node tools/test-online.mjs                # a game between two browsers online (dev server and server)
node tools/test-sync.mjs                  # sync between two browsers (dev server and server)
node tools/test-remind.mjs                # the reminder end to end (a build with PUBLIC_SHAH_SERVER=http://127.0.0.1:8787 on 3772, and the server)
node tools/test-offline.mjs [url]         # installed app offline (production preview or the live site)
node tools/test-live.mjs [url]            # after a deploy: the opening, an online game, sync, on the live site and server
node tools/shots.mjs                      # screenshots of every page in headless Chrome (dev server running)
```

## Deploy

The app: Cloudflare Pages, project `shah-trajneri`, production branch `master`.

```bash
npm run build
npx wrangler pages deploy dist --project-name shah-trajneri --branch master
```

The server, before the first build that uses it:

```bash
npx wrangler deploy -c server/wrangler.jsonc
npx wrangler secret put VAPID_PRIVATE -c server/wrangler.jsonc
```

The second command asks for the value; it is in `server/.dev.vars`. The Worker's URL is in
`.env.production` (`PUBLIC_SHAH_SERVER`), so `npm run build` points the app at it.

## Where things are

- `src/lib/coach.ts`: grading (win-chance loss, Lichess thresholds) and the Albanian explanations.
- `src/lib/engine.ts`: Stockfish in a Web Worker, spoken to in UCI.
- `src/lib/levels.ts`: the six strengths and their bots. The weak ones pick worse lines on purpose.
- `src/lib/store.ts`: progress in localStorage, and the spaced-repetition cards of your own mistakes.
- `src/lib/sync.ts`, `src/lib/merge.ts`: sync between phones (AES-GCM with a key derived from the sync code) and the
  merge rules.
- `src/lib/remind.ts`: the daily reminder's push subscription.
- `src/lib/server.ts`: where the server is.
- `src/scripts/play.ts`: a game against the engine, or two people on one phone.
- `src/scripts/online.ts`: a game online.
- `src/scripts/analyse.ts`: the analysis board and game review.
- `src/scripts/board/board3d.ts`: the wooden board in three.js: a folding chess box (it opens on the first visit of the
  day: lid, pieces out beside it, the box turned over, pieces set), camera angles, arrows, the replay, the mated king
  going over, promotions; the room and the set change in place.
- `src/scripts/board/looks.ts`: the four rooms (Biblioteka, Dritë dite, Pranë zjarrit, Natën) and the four sets (Dru,
  Llak, Xham, Metal); `src/components/LookPicker.astro` and `src/scripts/look.ts`: the Pamja picker.
- `src/scripts/board/staunton.ts`: the Staunton set, turned in the browser; the knight comes from `public/realism/knight.bin`.
- `src/scripts/board/realism.ts`: the photographed materials, the rooms' light, the four finishes of the pieces.
- `src/scripts/board/props.ts`: what stands on each room's table. `src/scripts/board/focus.ts`: the lens (depth of field)
  of the home screen and the opening.
- `src/scripts/celebrate.ts`: the streak's roll and the captured pieces popping in.
- `src/scripts/board/board2d.ts`: the flat board, used only where WebGL fails (every page shows the 3D table).
- `src/scripts/trainer.ts`, `src/data/repertoires.ts`: the opening trainer and its lines.
- `src/data/puzzles.json`: 1,120 puzzles from the Lichess database (CC0), each solution checked with the engine.
  Rebuilt with `tools/fetch-puzzles.mjs` and `tools/build-puzzles.mjs`.
- `src/data/lessons.ts`: the lessons.
- `server/src/`: the Worker.
  - `room.ts`: one online game; it checks moves with chess.js and keeps the clocks.
  - `vault.ts`: one encrypted progress copy.
  - `bell.ts`, `push.ts`: the reminders, with Web Push written on WebCrypto.
- `tools/postbuild.mjs`: the service worker (every built file precached, plus the reminder's notification), sitemap
  and robots.txt.
- `docs/SHQIP.md`: the Albanian terms and sentences, for a native speaker to check.

## Realism assets

`public/realism/` is built, not hand-made:

```bash
node tools/build-realism.mjs <polyhaven-download-dir>   # veneers, table woods, velvet, the four rooms (HDRIs halved)
node tools/knight-mesh.mjs <knight.glb> [18000] [0]     # the carved knight: simplified, scaled, occlusion baked in
```

The download dir holds the 1k files from api.polyhaven.com: white_maple_veneer, walnut_veneer_02, dark_wood,
lacquered_cherry_wood, oak_veneer_01, smoked_walnut_veneer and velour_velvet (diffuse, nor_gl, rough), and the HDRIs
billiard_hall, cayley_interior, fireplace and warm_restaurant_night. The knight's GLB was generated on Higgsfield
(a GPT Image photograph of a boxwood Staunton knight, lifted to 3D with Hunyuan3D v3, geometry only).

## Licences

- This app: GPL-3.0-or-later (`LICENSE`), because it ships Stockfish.
- Stockfish.js (`public/engine/`): GPL-3.0; its licence is in `public/engine/COPYING.txt`.
- Puzzle data: Lichess puzzle database, CC0.
- Phosphor icons: MIT. chess.js: BSD-2-Clause. three.js: MIT. GSAP: its own standard licence (free).
- Textures and room photographs: Poly Haven, CC0. The knight: generated for this app on Higgsfield (Luca's account).
