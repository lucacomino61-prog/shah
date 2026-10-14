---
name: Shah
description: An Albanian chess coach in the iOS 27 idiom, Liquid Glass floating over a lit wooden board.
colors:
  bg: "#f2f2f7"
  cell: "#ffffff"
  cell-press: "#e5e5ea"
  label: "#000000"
  label-2: "rgb(60 60 67 / 0.78)"
  label-3: "rgb(60 60 67 / 0.36)"
  sep: "rgb(60 60 67 / 0.29)"
  fill: "rgb(120 120 128 / 0.2)"
  fill-2: "rgb(118 118 128 / 0.12)"
  seg-thumb: "#ffffff"
  tint: "#007aff"
  tint-fill: "#0066d6"
  tint-ink: "#0066d6"
  red: "#ff3b30"
  red-fill: "#d70015"
  red-ink: "#d70015"
  orange: "#ff9500"
  orange-ink: "#c93400"
  green: "#34c759"
  green-ink: "#248a3d"
  last: "#ffd60a"
  glass: "rgb(248 248 250 / 0.7)"
  glass-stage: "rgb(30 32 34 / 0.6)"
  bg-dark: "#000000"
  cell-dark: "#1c1c1e"
  tint-dark: "#0a84ff"
  tint-ink-dark: "#409cff"
  stage-ground: "#070908"
  felt-pool: "#3d5444"
  felt-mid: "#24342a"
  felt-edge: "#111a14"
  felt-dark: "#090d0a"
  sq-light: "#e4c99a"
  sq-dark: "#84532f"
  mahogany: "#4b2213"
  mahogany-edge: "#2a1006"
  boxwood-stringing: "#e9d3a4"
  coord-inlay: "#ecd6aa"
  boxwood: "#f7ecd4"
  ebony: "#121214"
  piece-fill-w: "#f6f4ee"
  piece-edge-w: "#111214"
  piece-fill-b: "#17181b"
  piece-edge-b: "#f1efe9"
typography:
  wordmark:
    fontFamily: "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI Variable Display', 'Segoe UI', Roboto, sans-serif"
    fontSize: "clamp(5rem, 2rem + 17vw, 9.5rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.04em"
  large-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "2.125rem"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.022em"
  title1:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title2:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 700
  title3:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "-0.012em"
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.38
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
  caption2:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0"
rounded:
  capsule: "999px"
  sheet: "2.25rem"
  card: "1.625rem"
  menu: "1.5rem"
  list: "1.375rem"
  inner: "1.125rem"
  chip: "0.75rem"
  tile: "0.625rem"
spacing:
  2xs: "0.375rem"
  xs: "0.625rem"
  s: "1rem"
  m: "1.5rem"
  l: "2.25rem"
  xl: "3rem"
  gutter: "1rem"
  gutter-wide: "2rem"
  mast-h: "3.25rem"
  mast-h-wide: "4.25rem"
  tab-h: "3.875rem"
  acc-h: "2.875rem"
  acc-h-wide: "3rem"
components:
  button:
    backgroundColor: "{colors.fill-2}"
    textColor: "{colors.tint-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.capsule}"
    padding: "0 1.375rem"
    height: "50px"
  button-hover:
    backgroundColor: "{colors.fill}"
  button-solid:
    backgroundColor: "{colors.tint-fill}"
    textColor: "#ffffff"
    rounded: "{rounded.capsule}"
    padding: "0 1.375rem"
    height: "50px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.tint-ink}"
    padding: "0 0.75rem"
  cue:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    typography: "{typography.subhead}"
    rounded: "{rounded.capsule}"
    padding: "0 1.0625rem"
    height: "44px"
  cue-on:
    backgroundColor: "{colors.tint-fill}"
    textColor: "#ffffff"
  cue-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.tint-ink}"
    padding: "0 0.5rem"
  status-capsule:
    backgroundColor: "{colors.glass-stage}"
    textColor: "{colors.label}"
    rounded: "{rounded.capsule}"
    padding: "0 0.875rem 0 0.3125rem"
    height: "2.25rem"
  live-tag:
    backgroundColor: "{colors.red-fill}"
    textColor: "#ffffff"
    typography: "{typography.caption}"
    rounded: "{rounded.capsule}"
    padding: "0 0.625rem"
    height: "1.625rem"
  score-card:
    backgroundColor: "{colors.glass-stage}"
    textColor: "{colors.label}"
    typography: "{typography.footnote}"
    rounded: "{rounded.inner}"
    padding: "0.1875rem 0"
  coach-card:
    backgroundColor: "{colors.glass-stage}"
    textColor: "{colors.label}"
    rounded: "{rounded.card}"
    padding: "0.875rem 1rem 1rem"
    width: "min(calc(100% - 1.5rem), 34rem)"
  grade-pill:
    backgroundColor: "{colors.fill}"
    textColor: "{colors.label}"
    typography: "{typography.footnote}"
    rounded: "{rounded.capsule}"
    padding: "0.1875rem 0.625rem"
  tab-bar:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.label}"
    typography: "{typography.caption2}"
    rounded: "{rounded.capsule}"
    padding: "0.25rem"
    height: "3.875rem"
    width: "min(calc(100% - 1.5rem), 30rem)"
  tab-bar-selected:
    textColor: "{colors.tint-ink}"
    rounded: "{rounded.capsule}"
  list-group:
    backgroundColor: "{colors.cell}"
    textColor: "{colors.label}"
    rounded: "{rounded.list}"
  list-row:
    backgroundColor: "{colors.cell}"
    textColor: "{colors.label}"
    typography: "{typography.body}"
    padding: "0.6875rem 1rem"
    height: "2.875rem"
  list-row-pressed:
    backgroundColor: "{colors.cell-press}"
  segmented:
    backgroundColor: "{colors.fill}"
    rounded: "{rounded.capsule}"
    padding: "0.1875rem"
  segmented-thumb:
    backgroundColor: "{colors.seg-thumb}"
    typography: "{typography.subhead}"
    rounded: "{rounded.capsule}"
    height: "2.5rem"
  setup-sheet:
    backgroundColor: "{colors.glass-stage}"
    textColor: "{colors.label}"
    rounded: "{rounded.sheet}"
    width: "min(100% - 1rem, 34rem)"
  board-plate:
    backgroundColor: "{colors.tint-fill}"
    textColor: "#ffffff"
    typography: "{typography.footnote}"
    rounded: "{rounded.capsule}"
    padding: "0.3rem 0.75rem"
---

# Design System: Shah

## Overview

**Creative North Star: "The Native Table"**

Shah should feel like an app that shipped with an iPhone running iOS 27. Two places make up the whole app. The table pages (home, Luaj, Ushtrime, lessons, the opening trainer) fill the screen with a lit wooden board in a dark room, and everything else floats over it as Liquid Glass: a status capsule and score card top left, a round glass menu button top right, the coach as one glass card, a slim accessory carrying the headlines and the move rail above a floating capsule tab bar. Away from the table (Mësime, Progresi, 404) the app is an inset-grouped iOS list on the grouped background, under a large title.

The system font and the iOS system colours carry the interface. One tint blue does actions and selection; red, orange and green appear only as status (live, verdict grades, done marks). The board is an object, not a theme: maple and walnut squares, a mahogany frame with boxwood stringing, boxwood and ebony pieces, and a warm yellow on the last move, the same in both appearances. The broadcast world that came before this one (stone and ink bars, poster Mona Sans, the orange pointer) is gone; Luca replaced it on 2026-10-13 with "make now everything more like iOS 27 theme".

**Key Characteristics:**
- The lit table fills the screen on table pages; controls float over it as glass and never sit beside it in a sidebar.
- Liquid Glass is one recipe: tinted base, top sheen, lit rim, hairline, lifting shadow, heavy blur. The learner sets its tint from clear to tinted.
- Table pages always use the dark token set; list pages follow the system appearance.
- The system font, no web font. Hierarchy comes from the iOS text styles.
- Capsules for every control, continuous large radii for cards, lists and sheets.
- One tint for action, status colours only for status, yellow only for the last move.

## Colors

The iOS system palette in light and dark, a dark glass for the table, and the warm materials of a wooden set under a lamp.

### Primary
- **System Blue** (tint; tint-dark #0a84ff on dark): the one action and selection colour. Checkmarks, the slider track, the current-move cap on the rail, the review graph's now-line, focus rings (75% mix), text selection (32% mix), the caret. The 3D board reads it live from `--pointer` (an alias of `--tint`) for move marks, chosen square, arrows and their discs.
- **Filled Blue** (tint-fill): any blue fill that carries white text (solid buttons, the on cue, lesson step tiles, the board plate, the skip link, the study tag). A shade deeper than the system tint so white text passes AA.
- **Blue Ink** (tint-ink; tint-ink-dark #409cff): blue text and icons: quiet buttons, links, the current tab, guide times.

### Secondary: status
- **Red** (red, red-fill, red-ink): the Live tag (red-fill, white text, a dot in currentColor), blunders (grade pill, informant symbol, rail tick, graph marks), the low clock, the reset row. red-fill exists for the same AA reason as tint-fill.
- **Orange** (orange, orange-ink): inaccuracies and mistakes, the coach's warning line.
- **Green** (green, green-ink): best and good moves, the side to move on the score card (a dot with a 3px 28% halo), done marks, wins.

### Tertiary: the last move
- **Last-Move Yellow** (last): the warm highlight chess players expect, in both appearances: 0.4 opacity on the flat board, 0.26 and not tone mapped in 3D.

### Neutral
- **Grouped Background, Cell, Pressed Cell** (bg, cell, cell-press; bg-dark and cell-dark in dark, cell-press #2c2c2e): the page, the list groups, the pressed row.
- **Labels** (label, label-2, label-3): primary, secondary and tertiary text. Light label-2 is rgb(60 60 67 / 0.78), darker than iOS ships, so secondary text clears 4.5:1 on the grouped background. Dark and table pages use rgb(235 235 245 / 0.62) and 0.66 respectively.
- **Separators and Fills** (sep, fill, fill-2, seg-thumb): hairlines at 0.5px, the gray capsule fills, the segmented track and thumb.
- **Glass** (glass, glass-stage): the floating surfaces. Canonical values are expressions of `--glass-level` (default 0.5): light rgb(248 248 250 / 0.45 + level x 0.5), dark rgb(38 38 42 / 0.36 + level x 0.52), table rgb(30 32 34 / 0.34 + level x 0.52); the frontmatter records the default.

### The table and the set
- **Felt** (felt-pool to felt-dark): the radial pool behind the canvas and the whole picture for the flat board, with a vignette to 45% black at the corners and a 4rem fade into the page at its foot. The 3D felt is a 160-unit plane of noise cloth (repeat 90).
- **Studio Dark** (stage-ground): the 3D clear colour and fog colour.
- **Maple and Walnut** (sq-light, sq-dark): the flat squares. The 3D squares are painted per veneer leaf, maple hsl(34 50% 66%) and walnut hsl(23 44% 37%), each leaf shifted a shade, so the near-white boxwood pieces stand off the maple and the ebony off the walnut.
- **Mahogany, Edge, Boxwood Stringing, Coordinate Inlay** (mahogany, mahogany-edge, boxwood-stringing, coord-inlay): the frame, its stroke, the two pale lines, the inlaid coordinates (rgba(236, 214, 170, 0.9) in 3D).
- **Boxwood and Ebony** (boxwood, ebony): the 3D pieces. Flat pieces use piece-fill-w with piece-edge-w and piece-fill-b with piece-edge-b.

### Named Rules
**The One Tint Rule.** Blue means "you can act here" or "this is chosen". Status colours never stand in for it, and it never decorates.

**The Table Is A Place Rule.** Table pages always use the dark token set, and the felt, wood and set keep their own tones in both system appearances; only the list pages follow light and dark.

**The White-On-Fill Rule.** White text sits only on tint-fill or red-fill, never on the brighter system tint or red.

## Typography

**Display Font:** the system rounded face (ui-rounded, SF Pro Rounded, then the system sans) for the wordmark only
**Body Font:** the system font (-apple-system, BlinkMacSystemFont, SF Pro Text, system-ui, Segoe UI Variable Text, Segoe UI, Roboto, Helvetica Neue, Arial)
**Label/Mono Font:** none; clocks, counts and move numbers use tabular figures

**Character:** SF Pro where it exists and the platform sans elsewhere; no web font is loaded. The page sets body at 1.0625rem with -0.012em tracking, as iOS does.

### Hierarchy
- **Wordmark** (800 rounded, clamp(5rem, 2rem + 17vw, 9.5rem), 0.92): "Shah" on home, white at 0.9 over the table like the Lock Screen clock. The intro mark is the same face at clamp(3.75rem, 2rem + 9vw, 6.5rem); the navigation mark is rounded 700 at body size (title3 on desktop).
- **Large Title** (700, 2.125rem; 2.75rem from 768px, 1.08): list page titles.
- **Title 1** (700, 1.75rem, 1.12; 2rem on desktop): the move in the coach card. Non-move states (intro, note, end, solved, wrong, good) drop to Title 2 and wrap.
- **Title 2** (700, 1.375rem): the scoresheet and new-game sheet titles.
- **Title 3** (700, 1.25rem): group headers, title-case and bold in the iOS 26 manner; the end accuracy figure.
- **Body** (400, 1.0625rem, 1.4): list rows, buttons (600), guide rows.
- **Subhead** (0.9375rem): coach reasons (1.38, 60ch; callout 1rem on desktop), cues (600), segmented cells, ledes (46ch).
- **Footnote** (0.8125rem, 400 to 700): status text, score rows, grade pills, secondary row lines, group notes.
- **Caption / Caption 2** (0.75rem 700; 0.6875rem 600): the Live tag and lesson meta; tab labels.

### Named Rules
**The Text Styles Rule.** Sizes come from the iOS text-style ladder (--t-large to --t-cap2); no in-between sizes, no uppercase captions, no letter-spaced labels.

**The Figurine Rule.** Moves are written as figurine plus square (piece silhouette inline at 0.95em, 0.82em in the coach headline, then the square in 600 tabular figures), never as letter notation.

## Layout

Phone first. A table page is a stage of 100svh (min 36rem) with every glass surface absolutely positioned inside it at 0.75rem from the edges. On phones the navigation bar is removed from table pages and the motion switch moves into the tools menu. From the bottom up: the floating tab bar (3.875rem, a gap of max(safe-area, 0.75rem)) and the coach card just above it, centred at min(100% - 1.5rem, 34rem) (30rem for the tab bar). `--chrome-bottom` names the band the tab bar holds. Below 1024px the coach card is compact and keeps to its band under the still board (see The Still Board Rule) (Luca, 2026-10-13: it "takes like half the screen"): padding 0.6875 / 0.875 / 0.75rem, radius 1.5rem, the move at Title 2 and other states at Title 3, footnote pill and warning, and when a primary cue shows, the secondary cues become 44px round symbol buttons beside it (their text stays in the DOM as the accessible name). The accessory is hidden on phones; it only repeated the coach and general tips. Together the card and tab bar hold about a third of a 390 x 844 screen. At the top of a phone (Luca: "remove the 1 from top and make it more compact"), the status capsule is visually hidden wherever a score card exists (it stays for screen readers; the opponent's turn dot breathes while the engine thinks), and the score card becomes one 2.25rem capsule holding both players side by side (the opponent's label truncates, the learner's never does), with a 2.25rem menu button whose ::after keeps a 44px hit area; the open menu tightens to 2.75rem rows at callout size. On the play page a glass move strip sits under it (chess.com's idiom): every move in one line, numbers in label-3, the move on the board in a lighter capsule, sliding smoothly (instantly with motion off) to keep that move in view, the oldest moves fading at the leading edge; a tap opens the move. Insets: 3.5rem, 5.75rem with the strip. The board runs edge to edge on phones (Luca: "make the board bigger on phone"): side insets 0; the 3D board in the seat or overhead view frames the playing field (half + 0.04) across the screen and lets the frame's sides fall off it, the flat board crops its viewBox to 0 -44 800 888; on both the rank numbers move onto the left-hand file's squares (top-left, 700, in the other wood's colour) and the frame's own are not drawn. On a 390px screen the playing field grows by about 13%.

The board frames itself inside the stage insets `--inset-top / bottom / left / right` (phone 7.25 / 19 / 0.5 / 0.5rem; home 16 / 17rem). They must stay plain lengths, never calc(): the 3D board reads them with parseFloat.

From 1024px the iPad idiom takes over: the tab bar hides and the tabs float as one glass capsule in the middle of a 4.25rem navigation bar, fixed over the table on table pages; gutter 2rem. The status capsule and score card (21rem) sit at the top of a left column at 1.5rem, the coach card below them (21rem, 25rem from 1400px), the last moves as a glass card at the column foot, tools as a row of round glass buttons top right, the accessory spanning the foot. Insets become 5.5 / 5 / 24 (28 from 1400px) / 4.75rem. Home puts its guide on the right at 26rem.

List pages are a single column (max 46rem for lessons and progress) with a 1rem gutter, inset-grouped lists, group headers 2.25rem above their group. The scoresheet below the stage is capped at 40rem. Spacing steps: 0.375 / 0.625 / 1 / 1.5 / 2.25 / 3rem. Breakpoints: 640px (the sheet centres), 768px (larger large title), 1024px (desktop shell), 1400px (wider column). Tap targets are at least 44px; primary buttons 50px.

## Elevation & Depth

Depth is Liquid Glass over the table and flat cells on the list pages. Every floating surface uses one recipe; list groups have no shadow and separate from the grouped background by colour alone. The navigation bar is no bar: a scroll-edge layer under it (80% bg fading out, blur 10px, masked to transparent 1.25rem below) softens what scrolls beneath.

### Shadow Vocabulary
- **Liquid Glass** (`background-color: var(--glass); background-image: linear-gradient(180deg, var(--glass-sheen), transparent 46%); backdrop-filter: blur(calc(16px + var(--glass-level) * 24px)) saturate(190%); box-shadow: inset 0 1px 0 var(--glass-hi), inset 0 0 0 0.5px var(--glass-rim), var(--glass-depth)`): tab bar, nav capsule, motion switch, status capsule, score card, menu button and menu, coach card, accessory, last-moves card, promotion choices, setup sheet. Menus, the open menu button and the sheet use `--glass-strong`.
- **Glass depth** (light `0 12px 32px -10px rgb(0 0 0 / 0.22), 0 2px 6px rgb(0 0 0 / 0.07)`; table `0 16px 38px -12px rgb(0 0 0 / 0.66), 0 2px 8px rgb(0 0 0 / 0.32)`).
- **Segmented thumb** (`0 3px 8px rgb(0 0 0 / 0.16), 0 1px 1px rgb(0 0 0 / 0.08)`) and **slider thumb** (`0 0.5px 4px rgb(0 0 0 / 0.12), 0 6px 13px rgb(0 0 0 / 0.12)`).
- **Over-table type** (`text-shadow: 0 2px 30px rgb(0 0 0 / 0.35)` on the wordmark, `0 1px 12px rgb(0 0 0 / 0.5)` on the line under it).
- **Piece in hand** (`filter: drop-shadow(0 8px 6px rgb(0 0 0 / 0.28))`): a dragged flat piece.

### The Studio (3D depth)
One warm spot lamp (#fff0dc, intensity 3.6, angle 0.5, penumbra 0.62, no decay) hangs high over the player's left shoulder at (-12, 20, 9), mirrored for black; 1024 shadow map, VSM radius 5 bias -0.0006 (PCF radius 2 as fallback). A dim hemisphere (#8fa596 over #0c140f, 0.34) and a room environment at 0.45, set per material and lit by a long softbox low behind the board, supply reflections. Neutral tone mapping at exposure 1.04; clear colour stage-ground. Fog in stage-ground from 26 to 72 units lets the enlarged felt run on into the dark, so a low camera never finds the table's edge.

Materials: oiled mahogany frame (rounded box radius 0.06; roughness 0.78, specularIntensity 0.15, envMapIntensity 0.7, no clearcoat), veneer squares (roughness 0.88, specularIntensity 0.08, envMapIntensity 0.55, no clearcoat: the lamp lights the board but never mirrors in it), boxwood stringing (roughness 0.85), felt (roughness 1, envMapIntensity 0.05), boxwood pieces (roughness 0.4, clearcoat 0.5 at 0.18, envMapIntensity 0.85), ebony pieces (roughness 0.26, clearcoat 1 at 0.05, envMapIntensity 1.25).

Camera angles: Si lojtar (default, the player's seat straight behind your pieces at elevation 1.396 rad, 80 degrees, distance 13), Nga lart (1.54 rad, 88 degrees, distance 15), Afër tabelës (the low three-quarter the home page orbits: 0.56 rad and azimuth -0.5 wide, 0.72 and -0.42 on an upright phone, distance 15).

**The Still Board Rule.** While a game, lesson or puzzle is on the table the board does not move (Luca, 2026-10-14: "make the board to not move when playing a game or lesson or puzzles"). No lean toward the mouse, and on phones no reframing as the coach card grows or shrinks: `keepBoardStill` gives the card a fixed band under the board, sized once from the screen (the room left after a board about as tall as the screen is wide, between 10.5rem and 15rem), and the card never grows past it (`--card-max`). When the coach says more, the words give way, never the buttons: the reasons scroll first, then a replayed line or the end figures, and on a short band (under 13rem, `data-tight`) the end of a game puts its buttons above its figures. Only the learner turns the board (flip, camera angle) or a new screen size moves it. The home page's slow orbit is the one camera motion left.

### Named Rules
**The One Recipe Rule.** Anything that floats over the table or the content is Liquid Glass by the shared recipe; nothing invents its own blur, tint or shadow.

**The Glass Follows The System Rule.** `--glass-level` drives tint and blur together and is set on Progresi > Pamja (stored as `shah.glass`, applied in the head before paint). Reduce Transparency makes the glass solid cell colour with no blur; Increase Contrast draws the rim in label-2 and uses the strong glass.

## Shapes

Capsules (999px) for every control: buttons, cues, tabs, the nav capsule, status and live tags, grade pills, the segmented track and thumb, the accessory, the grabber, progress bars. Round 44px buttons for the menu on phones, the motion switch on phones and the desktop tools. Large continuous radii for containers: sheet 2.25rem, coach card 1.625rem, menu 1.5rem, lists 1.375rem, menu rows and score card 1.125rem, lesson tiles and scoresheet cells 0.625rem. Separators are 0.5px hairlines inset from the leading edge (1rem, or past the leading tile). The board keeps its own geometry: square squares, a rounded-box frame, turned pieces, arrows with round joins and caps and a tint disc carrying a white number.

## Components

### Buttons
Capsules in the iOS manner: one filled for the primary action, gray fill for the rest, plain tint text for the least.
- **Shape:** capsule, min-height 50px, 0 1.375rem, body size, 600.
- **Solid:** tint-fill with white text; brightness 1.08 on hover.
- **Gray:** fill-2 with tint-ink text; fill on hover (fine pointers only). Danger swaps the text to red-ink.
- **Quiet:** transparent, 0.75rem inline padding.
- **Press:** scale 0.96 over 120ms ease-out. Disabled at 0.4 opacity.

### Cues (on glass)
The coach card's capsule buttons: 44px, subhead 600, fill background with label text, scale 0.95 on press. The on cue ("Shiko pse") is tint-fill with white text; quiet cues are tint-ink text that underlines on hover.

### Table surfaces (signature)
- **Status capsule:** a 2.25rem glass capsule holding a tag and the status line. While a game runs the tag is red-fill "Drejtpërdrejt" with a white dot, the way the TV app marks live; in study it returns to tint-fill.
- **Score card:** glass at 1.125rem radius, two rows separated by a hairline; a tertiary dot per player turns green with a halo for the side to move; captured pieces overlap as small silhouettes; the clock in tabular subhead turns red-ink when low.
- **Tools:** on phones a round glass button opens a glass menu (strong glass, 1.5rem radius, 15.5rem, label leading and symbol trailing, rows 2.875rem; opens 300ms on the sheet curve from scale 0.86 and blur 10px). On desktop the tools are a row of round 44px glass buttons; pressed mixes 40% tint into the glass with a white icon.
- **Coach card:** one glass card. The move at Title 1 with its informant symbol in the status colour, and the verdict as a status pill (footnote 700): green for best and good, orange 18-24% for inaccuracy and mistake, red 22% for blunder. While the coach looks, the move waits in label-3 and inks in over 320ms. Reasons in subhead, a warning in orange-ink, then the cues. The label is visually hidden; the headline speaks.
- **Accessory** (wide screens only; hidden below 1024px): a glass capsule along the foot of the table: headlines crawl (40s linear, edges masked, pause on hover, stop with motion off) separated by small label-3 dots, and a rail of ticks along its foot, one per move, taller and in the status colour the worse the move (2px label-3 to 11px red); the current move carries a 2px tint cap.

- **Online game** (`/online/`): the play page's table without the coach's voice. The card carries the room: the four-letter code in monospace at 1.6em with 0.18em tracking while the room waits (so it can be read aloud across a table), then "Radha jote" / "Radha e shokut", the friend's last move, a draw offer, or the result ("Fitove", "Humbe", "Barazim" with the reason). One primary cue at a time (Krijo lojën, Hyr në lojë, Dërgo lidhjen, Prano barazimin, Merr fitoren, Revansh), the rest as symbol buttons on phones, except "Hyr me kod", which keeps its words (`cue--label`). The friend's name on the score card reads "Shoku · larg" while their phone is away. The page title gains "● Radha jote" when it is the learner's move in a background tab.

### Inputs
- **Segmented control:** capsule fill track with 0.1875rem padding, 2.5rem cells, the choice on a seg-thumb capsule with a soft shadow.
- **Checkmark list:** inset-grouped rows (min 3.25rem) with a tint check drawn by the `--check` mask (Phosphor check, bold) on the chosen row; used for levels and puzzle themes.
- **Slider (Pamja):** a 4px capsule track filled in tint to a white 1.75rem thumb; it sets `--glass-level` live.
- **Switch:** the iOS switch (green on), 0.45 opacity when it cannot be used (the reminder in a browser without push).
- **Value row:** a select inside a row, its value trailing in label-2 with a caret-up-down, as an iOS menu row (the reminder's hour).
- **Code fields:** monospace, uppercase; the sync code in a row field with an XXXX-XXXX-XXXX-XXXX placeholder, the room code as one 2rem cell, centred, 0.4em tracking.

### Lists
Inset-grouped groups on cell, radius 1.375rem, rows min 2.875rem with 0.6875rem 1rem padding, pressed in cell-press, hover a 55% mix on fine pointers. Disclosure uses the `--chevron` mask (Phosphor caret-right) in label-3, rotated 90 degrees when a disclosure group opens. Lesson rows lead with a 2.25rem tile at 0.625rem radius: tint-fill with the white step number, or white or black for the side a repertoire trains. Results sit in small tinted capsules (win green, loss red).

### Sheets and overlays
- **New-game sheet:** the opponent is a three-way segmented control (Motori, Shok këtu, Shok online) when the server is there; online hides the levels and the button reads "Krijo lojën online". The online page's own sheets (Lojë online, Hyr me kod) are the same dialog. A strong-glass dialog at 2.25rem radius with a 2.25rem grabber on phones, rising from the bottom over 460ms on the sheet curve; from 640px it centres and pops (scale 0.94, blur 8px, 320ms). Backdrop rgb(0 0 0 / 0.42). Title 2 centred, footnote legends, segmented control, checkmark list, full-width capsule buttons.
- **Intro:** black, the rounded mark, and an 11rem 4px capsule progress bar filled in tint from the script's `--p`.
- **Promotion:** glass tiles at 1.25rem radius over a 42% black scrim.

### Navigation
- **Phone:** a floating capsule tab bar of glass, five tabs (Luaj, Ushtrime, Mësime, Analizo, Progresi) with a 1.625rem icon over a caption2 label; the current tab is tint-ink in a glass-press lens; press scales 0.94. No navigation bar on table pages; elsewhere the rounded mark sits left and the round motion button right, over the scroll-edge blur.
- **Desktop:** the tabs float as one glass capsule centred in the navigation bar, 40px items with icon and subhead label, current in tint-ink on glass-press, hover fill-2; the motion switch becomes a labelled glass capsule.

### Board
The board is always the 3D table on every page (Luca, 2026-10-13: "i want the board to be always 3d"); there is no switch. Puzzles, lessons and the trainer put unused pieces away when they jump to a position (keepTaken: false), while a game keeps what was taken lying beside the board. The flat board remains only as the fallback where WebGL fails: an SVG with the same frame, stringing, maple and walnut and inlaid coordinates. Marks: last move in last-move yellow, check in the status red (0.5 on the flat board; the 3D check glow takes `--red` too), chosen tint at 0.3, focus a 7px tint ring, move dots tint at 0.85, captures as tint rings, keyboard cursor a dashed black square, arrows tint at 0.88 (quiet 0.66) with a white number in the system font on a tint disc. 3D pieces settle on springs (rest k170 c19, carry k560 c42, tilt k210 c17); flat pieces slide 240ms ease-out. Arrows draw on from the tail.

## Do's and Don'ts

### Do:
- **Do** fill table pages with the lit board and float every control over it as Liquid Glass by the shared recipe.
- **Do** use the dark token set on every table page, whatever the system appearance.
- **Do** use the system font and the iOS text-style ladder; the rounded face only for the wordmark and intro mark.
- **Do** put white text only on tint-fill (#0066d6) or red-fill (#d70015), and keep light label-2 at rgb(60 60 67 / 0.78).
- **Do** use the tint for action and selection, red, orange and green only for status, and yellow only for the last move.
- **Do** keep `--inset-*` on the stage as plain lengths; the 3D board parses them with parseFloat.
- **Do** honour Reduce Transparency (solid glass) and Increase Contrast (drawn rim), and make the Stop-animations switch and reduced motion zero transitions with 0s, not 0.01ms.
- **Do** keep the board matte: no clearcoat on the frame or squares, the lamp never mirrored in the board.

### Don't:
- **Don't** build the flat green-and-cream board widget with a grey eval bar and a sidebar of tabs.
- **Don't** add web-dashboard chrome: cards in grids, hairline-bordered panels, uppercase captions.
- **Don't** give the table a light theme: felt, wood and pieces keep their tones in both appearances.
- **Don't** load a web font or set text as an icon glyph; icons are Phosphor SVG, and list symbols are CSS masks.
- **Don't** put a solid bar under the navigation; the scroll edge is a fading blur.
