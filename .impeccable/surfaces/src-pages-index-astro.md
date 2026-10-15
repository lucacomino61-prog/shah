---
version: 2
slug: "src-pages-index-astro"
primary_target: "src/pages/index.astro"
related_targets: ["src/pages/luaj.astro","src/pages/ushtrime.astro","src/pages/mesime","src/pages/progresi.astro"]
---

Scope: the whole app (home, play, puzzles, lessons, opening trainer, progress). Visitor mode: Operate (play, puzzles, trainer); lessons are Read inside the same world; home is the app's front screen. Audience: one learner who knows the rules, on a phone, short sessions, Albanian.

## Direction contract

THESIS: A chess app that feels native on an iPhone running iOS 27. The lit wooden table fills the screen and everything else floats over it as Liquid Glass; away from the table the reading pages sit in the same room, a still of the table behind tinted glass lists (2026-10-15). Refused: the flat green-and-cream board widget with a grey eval bar and a sidebar of tabs, and any web-dashboard chrome (cards in grids, hairline-bordered panels, uppercase captions).

PINNED BY LUCA: "make now everything more like iOS 27 theme" (2026-10-13). This replaces the TV-broadcast world he asked for on 2026-10-12 ("a little broadcast like news broadcast"). Still pinned from before: "whole page the table", the board "more classic high quality wood", the seat camera at 80 degrees ("more up"), the board matte ("make the light to not reflect on the board"), pieces contrasted against the squares.

OWN-WORLD: iOS 27. The system font (SF Pro on Apple devices, the platform sans elsewhere), the iOS system colours in light and dark (grouped background #F2F2F7 / #000, cells #FFF / #1C1C1E, labels, separators, fills), the tint blue for actions and selection, red, orange and green only as status. Liquid Glass as iOS 27 tuned it: heavy diffusion (blur 28px, saturate 190%), a tinted base, a lit top rim, a hairline, and a soft shadow that lifts each surface off the table; solid under Reduce Transparency, and the learner sets it from clear to tinted on Progresi > Pamja (the iOS 27 slider; stored as shah.glass, applied in the page head before paint). The navigation bar is no bar: a soft blur fades out below its controls (the iOS 26 scroll edge), and on desktop table pages it floats over the table. The table pages always use the dark glass, because the table is a dark room. The board stays an object: maple and walnut, mahogany frame, boxwood and ebony pieces, a warm yellow on the last move.

STORY: The learner opens Shah, taps Luaj, plays; after each move the coach card names the move and its verdict in a status pill, says why, and offers "Shiko pse", which replays the better line on the board with numbered arrows. Own mistakes come back as puzzles; lessons and the opening trainer are lists one tab away; progress is a Settings-style summary.

FIRST VIEWPORT: Phone: the table fills the screen; a status capsule (a red Live tag while a game runs) and a two-row score card top left, a round glass button top right that opens a glass menu; the board seen from the player's seat at 80 degrees; the coach as one glass card; the headlines in a glass accessory above the floating capsule tab bar. Desktop: the iPad idiom, the tab bar as a capsule in the middle of the navigation bar, the coach card in a left column, tools as a row of round glass buttons. Home: "Shah" in Bodoni Moda at poster size, "Luaj" as the one filled button, a glass dashboard: the next opponent's portrait (or the game that waits), today's puzzle as a diagram, the next lesson of the course.

FORM: The iOS app, rendered by the web. Components follow their iOS counterparts: tab bar with a bottom accessory, menu, sheet with a grabber, segmented control, inset-grouped list with chevrons and checkmarks, capsule buttons (filled for the one primary action, gray fill for the rest, plain tint text for the least), large title. Signature moments: the player deck (2026-10-15, the awwwards-blueprints pass Luca asked for: a fanned deck of oil-portrait player cards; the chosen card flies to the seat across the table, where the opponent speaks now and then), and, kept, "Shiko pse", the board plays the line while numbered arrows draw on, then the pieces fly back to the game.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- App name beyond the working wordmark "Shah".
- The share image (public/og.png) is re-rendered from the iOS home (tools/make-icons.mjs). The app icons are the boxwood king on ink from public/favicon.svg; iOS rounds them itself.
