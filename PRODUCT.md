# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro, chosen by Luca on 2026-10-12 (offered against Vite + TypeScript and plain HTML). Pages are static; the
board, the engine and the coach are client scripts. three.js for the marble board, GSAP for motion (its ticker is
the only animation loop), chess.js for the rules, Stockfish compiled to WebAssembly for the engine. Runs on
localhost; no deploy target is chosen yet, and nothing ships until Luca says "deploy".

## Users

One learner, Luca, who knows how the pieces move but loses games to loose pieces and missed tactics. He wants to
get better by playing, being told why a move was bad, and trying again. He mostly uses the app on his phone, in
short sessions.

## Product Purpose

A chess coach that teaches by playing. You play the engine at a strength you can beat. After every move, the coach
grades it and says in plain Albanian what it did and what was better, with the better move drawn on the board. You
can retry a mistake at once. Puzzles and short lessons train the patterns behind the mistakes: loose pieces, forks,
pins, back-rank mates and opening principles. Success means fewer blunders per game over time and puzzles solved
on the first try.

## Positioning

The coach speaks Albanian and explains moves in words rather than numbers. It runs fully in the browser on a free
engine: no account, no server, no cost per question. The board is a polished marble set in 3D, not a flat web
widget.

## Operating Context

- Short sessions on a phone: one game, or a handful of puzzles.
- Games against Stockfish at eight strengths, from one that blunders on purpose to full strength.
- A move-by-move review, built while the game is played.
- Progress (games, puzzles, recurring mistake types) stays in the browser's own storage on that device.

## Capabilities and Constraints

- Language: Shqip (Albanian) everywhere. Moves use figurine notation (♘f3), so no letter set is language-bound.
- Coach: free engine coach only. The Stockfish analysis is turned into sentences by rules: loose pieces, missed
  captures, forks, mates, opening principles. There is no LLM chat (Luca chose this over a paid Claude chat).
- Engine: Stockfish, single-threaded WebAssembly build, in a Web Worker. It is GPL-3.0: if the app is ever
  published, its source must be offered too.
- Puzzles: real positions from the Lichess puzzle database, which is CC0. Solutions are checked against the engine
  before they ship.
- Strength labels are approximate. No Elo figure is shown as a measured rating.
- Undecided: deploy target, domain, app name beyond the working title.

## Brand Commitments

- The board is a 3D three.js board, first built in marble for LC/salvato. On 2026-10-12 Luca asked for "the whole
  page the table", the coach's suggestions as "a little broadcast like news broadcast", and the board "more classic
  high quality wood" with "a better angle". So: maple and walnut squares, a mahogany frame with boxwood stringing,
  boxwood and ebony pieces, on a dark felt table under one lamp. The camera defaults to a three-quarter view, with
  overhead and low angles one button away.
- The play, puzzle and lesson screens are a broadcast: the lit table fills the screen and the coach speaks in TV
  graphics (live bug, score bug, lower third, ticker).
- The board also has a flat 2D view (the default for puzzles and lessons). Its pieces are the side profiles of the
  turned pieces.
- The award-site design vocabulary applies, as on Luca's other builds: poster-scale type, two colours, one
  signature moment, a Stop-animations switch, and a loader with a skip.

## Evidence on Hand

- No users, testimonials or results exist. The app makes no claims about rating gains.
- Puzzle data is Lichess CC0. Lesson positions are written for this app and checked with the engine.

## Product Principles

1. Explain before you judge. A grade without a reason teaches nothing.
2. Make it cheap to try again. Retrying a mistake is the main learning loop.
3. Keep it beatable. The default opponent should lose sometimes.
4. Never invent facts: no fake ratings, statistics or praise.
5. Phone first. Every flow must work with one thumb on a 375 px screen.

## Accessibility & Inclusion

- Every move can be made by tapping (piece, then square) as well as by dragging. A keyboard path covers the same
  moves on a laptop.
- Coach verdicts go to a live region, so a screen reader announces them.
- The Stop-animations switch and prefers-reduced-motion both place pieces at once.
- WCAG 2.2 AA contrast for all text, including text over the board.
