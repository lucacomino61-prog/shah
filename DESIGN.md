---
name: Shah
description: An Albanian chess coach staged as a commentary-room broadcast over a lit wooden board.
colors:
  stone: "#e6e5e1"
  ink: "#111214"
  text-2: "#595a5a"
  rule: "#c4c3c0"
  rule-strong: "#91918f"
  well: "#d9d8d5"
  pointer: "#e65719"
  pointer-ink: "#a83707"
  pointer-dark: "#f27636"
  pointer-ink-dark: "#f7904b"
  pointer-stage: "#f06a2c"
  verdict-on-stone: "#c8460f"
  stage-ground: "#070908"
  room-black: "#0b0907"
  bar-umber: "#110e0b"
  bar-umber-raised: "#14110e"
  sheet-umber: "#15120f"
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
  boxwood: "#ecd8ae"
  ebony: "#1a1a1d"
  piece-fill-w: "#f6f4ee"
  piece-fill-b: "#17181b"
  piece-edge-b: "#f1efe9"
typography:
  display:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "clamp(5.5rem, 2rem + 26vw, 24rem)"
    fontWeight: 880
    lineHeight: 0.86
    letterSpacing: "-0.045em"
    fontVariation: "'wdth' 125"
  verdict:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.6rem + 3.2vw, 4rem)"
    fontWeight: 880
    lineHeight: 0.86
    letterSpacing: "-0.045em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0.01em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 1.2rem + 0.6vw, 1.75rem)"
    fontWeight: 820
    lineHeight: 1.1
    fontVariation: "'wdth' 118"
  caps:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 860
    lineHeight: 1
    letterSpacing: "0.05em"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 430
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
  body-broadcast:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 430
    lineHeight: 1.42
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "'Mona Sans Variable', 'Mona Sans', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.5
    fontVariation: "'wdth' 100"
rounded:
  none: "0px"
spacing:
  2xs: "0.375rem"
  xs: "0.625rem"
  s: "1rem"
  m: "1.5rem"
  l: "2.25rem"
  xl: "3.5rem"
  gutter: "1rem"
  gutter-wide: "2rem"
  mast-h: "3.5rem"
  mast-h-wide: "4rem"
  tab-h: "4rem"
  ticker-h: "3.75rem"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "48px"
  button-hover:
    backgroundColor: "{colors.well}"
  button-solid:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stone}"
    rounded: "{rounded.none}"
    padding: "0 1.125rem"
    height: "48px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "0 0.625rem"
    height: "48px"
  cue:
    backgroundColor: "transparent"
    textColor: "{colors.stone}"
    typography: "{typography.caps}"
    rounded: "{rounded.none}"
    padding: "0 0.8rem"
    height: "44px"
  cue-on:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
  tool:
    backgroundColor: "{colors.bar-umber-raised}"
    textColor: "{colors.stone}"
    rounded: "{rounded.none}"
    size: "44px"
  tool-pressed:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
  live-bug:
    backgroundColor: "{colors.pointer-stage}"
    textColor: "{colors.ink}"
    typography: "{typography.caps}"
    padding: "0.35rem 0.55rem 0.4rem"
  status-bug:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    padding: "0.35rem 0.6rem 0.4rem"
  score-row:
    backgroundColor: "{colors.bar-umber-raised}"
    textColor: "{colors.stone}"
    padding: "0.1rem 0.55rem"
    height: "1.6rem"
  lower-tag:
    backgroundColor: "{colors.pointer-stage}"
    textColor: "{colors.ink}"
    typography: "{typography.caps}"
    padding: "0.32rem 0.6rem 0.36rem"
  lower-head:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    typography: "{typography.verdict}"
    padding: "0.3rem 0.75rem 0.4rem"
  lower-body:
    backgroundColor: "{colors.bar-umber}"
    textColor: "{colors.stone}"
    typography: "{typography.body-broadcast}"
    padding: "0.6rem 0.75rem 0.75rem"
  ticker-band:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    height: "2.5rem"
  tab-bar:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.text-2}"
    typography: "{typography.label}"
    height: "4rem"
  masthead:
    backgroundColor: "{colors.stone}"
    textColor: "{colors.ink}"
    height: "3.5rem"
    padding: "0 1rem"
  setup-sheet:
    backgroundColor: "{colors.sheet-umber}"
    textColor: "{colors.stone}"
    padding: "1.5rem"
    width: "min(100% - 1rem, 34rem)"
  board-plate:
    backgroundColor: "{colors.pointer}"
    textColor: "{colors.ink}"
    padding: "0.25rem 0.625rem 0.375rem"
---

# Design System: Shah

## Overview

**Creative North Star: "The Commentary Room"**

A dark studio round one lamp, a classic wooden board on green felt, and over it a commentator who speaks in television graphics. The table is a place, not a page colour: every play, puzzle and home screen fills the viewport with the lit board, and the interface arrives as broadcast furniture laid on top of it (a live bug and score bug top left, a tool column top right, a lower third, a crawling ticker). Reading pages (lessons list, progress, 404) step out of the studio onto plain stone paper with the same type and the same pointer.

The graphics commit to two colours, stone and ink, square-cornered, with one lacquer orange as the commentator's pointer: the tag, the arrows, the chosen square, the live verdict. One family, Mona Sans, carries every voice; rank comes from the width axis and weight, not from a second face. The verdict is the interface: the move and its informant symbol (!! ! !? ?! ? ??) are set as type at poster size in the lower third, never as a badge.

Built divergence from the direction contract, recorded because the build wins: the contract asks for every neutral to be stone or ink at an alpha; the shipped broadcast bars use a warm umber-black family (bar-umber, bar-umber-raised, sheet-umber, room-black) rather than ink, and the stage reading text runs at 0.9375rem beside the 1rem page body rather than a single body size.

**Key Characteristics:**
- The lit table fills the screen; graphics sit on it, never beside it in a sidebar.
- Two colours plus one pointer; no third hue in the interface.
- Square corners everywhere in 2D; the only rounding is the 3D frame's turned edge.
- One family, ranked by width (100 / 108 / 112 / 118 / 125) and weight (430 to 900).
- Expanded black caps for broadcast type; normal width for reading.
- Motion is broadcast motion: wipes, crawls, draw-on arrows, pieces that fly and settle on springs.

## Colors

Stone paper and ink, a lacquer pointer, and the warm materials of a wooden set under a lamp.

### Primary
- **Lacquer Pointer** (pointer; pointer-dark in the dark theme; pointer-stage on the lit table): the commentator's only colour. Live bug, lower-third tag, ticker separators, arrows and their numbered discs, last-move and chosen-square tints, check glow, focus ring, text selection, the blunder tick on the rail. Always carries ink text when it is a fill. The 3D board reads it live from the CSS custom property, so board marks and graphics stay one colour.
- **Pointer Ink** (pointer-ink; pointer-ink-dark on dark grounds): the same lacquer dark (or light) enough for small text: guide times, warnings, mistake symbols on the scoresheet, done marks, links on reading pages.
- **Verdict on Stone** (verdict-on-stone): the informant symbol of an inaccuracy, mistake or blunder when it sits on the stone lower-third head. Poster size only (about 3.8:1 on stone, passes as large text, not as body text).

### Neutral
- **Stone** (stone): the light ground of reading pages; the bright bar in broadcast graphics (status bug, lower-third head, ticker band, pressed tools, the on-state cue).
- **Ink** (ink): text on stone and on every pointer fill; the dark ground in the dark theme.
- **Second Text, Rule, Strong Rule, Well** (text-2, rule, rule-strong, well): ink mixed into stone at 66%, 16%, 40% and 6%. The dark theme and the stage re-mix stone into their dark ground at matching percentages (70 / 15-16 / 38 / 6-7%). Canonical values are the color-mix expressions in the stylesheet.
- **Bar Umber family** (bar-umber at 0.92-0.94 alpha for the lower-third body, ticker rail, programme guide and scoresheet bug; bar-umber-raised at 0.86-0.9 for tools and score rows; sheet-umber solid for the new-game sheet and open tool list; room-black for the intro card and promotion scrim; stage-ground for the page behind the canvas). Hairlines inside these bars are stone at 0.1-0.16 alpha.

### Tertiary: the table and the set
- **Felt** (felt-pool to felt-dark): the radial pool of green felt under the lamp, falling to near-black at the edges; the stage background and the whole picture behind the flat board. A further vignette darkens the corners to 45% black.
- **Maple and Walnut** (sq-light, sq-dark): the flat board's squares. The 3D squares are painted per leaf a step closer together (maple hsl 34 50% 66%, walnut hsl 23 44% 37%, each leaf shifted a shade), so the near-white boxwood pieces stand off the maple and the ebony off the walnut (Luca, 2026-10-13: "more contrasted so pieces can be viewed").
- **Mahogany and Boxwood Stringing** (mahogany, mahogany-edge, boxwood-stringing, coord-inlay): the frame, its edge, the two pale inlaid lines, and the inlaid coordinates.
- **Boxwood and Ebony** (boxwood, ebony): the 3D pieces. The flat pieces use piece-fill-w with an ink edge and piece-fill-b with a pale edge.

### Named Rules
**The One Pointer Rule.** Orange means "the commentator is pointing here". It never decorates, never marks the current move on the rail (that cap is stone), and never appears as a second accent hue.

**The Table Is A Place Rule.** The felt, wood and set keep their own tones in both system themes; only the paper pages follow light and dark.

## Typography

**Display Font:** Mona Sans Variable (with Mona Sans, system-ui, -apple-system, Segoe UI)
**Body Font:** the same family at normal width
**Label/Mono Font:** none; numbers use tabular figures

**Character:** one grotesque doing every job. At width 125 and weight 860-900 it is broadcast caps and poster type; at width 100 and weight 430 it is a quiet reading voice.

### Hierarchy
- **Display** (880, width 125, giant clamp, line-height 0.86, -0.045em): page titles on reading pages, sized from their own letter count so the longest word always fits without breaking. The home wordmark runs larger (clamp(6rem, 1rem + 30vw, 22rem)) in stone over the board, the intro mark at clamp(5rem, 1rem + 26vw, 16rem).
- **Verdict** (880, width 125, clamp(2.25rem, 1.6rem + 3.2vw, 4rem); clamp(2.5rem, 1rem + 2.6vw, 4.25rem) on wide screens): the move in figurine notation plus its informant symbol in the lower-third head. Non-move states (intro, note, end, solved) drop to clamp(1.5rem, 1.1rem + 1.8vw, 2.5rem).
- **Headline** (900, width 125, 1.75rem, uppercase): the new-game sheet title.
- **Title** (820, width 118, step-title): lesson row titles, scoresheet and progress section heads.
- **Caps** (860-900, width 125, 0.6875-1rem, uppercase, 0.03-0.08em): live bug, lower-third tag and title, intro line, cues (780, width 115), guide labels (820, width 118), ticker (700, width 112).
- **Body** (430, width 100, 1rem, 1.5): reading pages; ledes cap at 42ch.
- **Broadcast body** (430, 0.9375rem, 1.42; 1rem on wide screens): coach reasons in the lower third, max 56ch.
- **Label** (560-600, 0.8125rem): tab labels, meta, move numbers.

### Named Rules
**The Width Carries Rank Rule.** Hierarchy is width and weight inside one family. No second typeface, no italics for emphasis.

**The Figurine Rule.** Moves are written as figurine plus square (piece silhouette inline at 0.95em, then the square in 700 tabular figures), never as letter notation.

## Layout

Phone first. Stage pages are a fixed-height stage (100svh less the tab bar, min 34rem) with every graphic absolutely positioned inside it at 0.75rem from the edges (1.5rem on wide screens). On phones the masthead is removed from stage pages and the table takes its room; a four-tab bar sits at the bottom (4rem plus safe area). From 1024px the tab bar becomes masthead navigation (4rem tall, 2rem gutter), the lower third moves into a left column (min(21rem, 30vw), 25rem from 1400px) beneath the bugs, a scoresheet bug fills the column foot, and the board is inset to the right of it. The 2D board is placed by stage insets (--inset-top / bottom / left / right) that each page tunes.

Reading pages are a single column with a 1rem gutter, ledes at 42ch, rows separated by 1px rules and section heads underlined by a 2px ink rule. The scoresheet below the stage is capped at 40rem (48rem wide). Spacing steps: 0.375 / 0.625 / 1 / 1.5 / 2.25 / 3.5rem. Breakpoints: 640px (setup sheet centres), 1024px (desktop shell), 1400px (wider column). Every tap target is at least 44px; primary buttons 48px.

## Elevation & Depth

The interface is flat; depth belongs to the 3D table. Bars are solid or near-solid fills with no drop shadow; layering is told by fill (stone over umber over felt) and by z-order. The few shadows are functional: a soft text shadow on stone type set directly over the board, a lift shadow under a dragged flat piece, a 6px ground-coloured halo behind the focus ring. Inset 2px underlines (ink for navigation, pointer for the current move and chosen theme) do the work of selection.

### Shadow Vocabulary
- **Over-table type** (`text-shadow: 0 0.03em 0.12em rgb(0 0 0 / 0.45)` for the wordmark; `0 1px 8px rgb(0 0 0 / 0.6)` for the line under it): legibility of stone type set straight on the lit board.
- **Piece in hand** (`filter: drop-shadow(0 8px 6px rgb(0 0 0 / 0.28))`): a flat piece being dragged.
- **Focus halo** (`outline: 2px solid pointer; outline-offset: 3px; box-shadow: 0 0 0 6px ground`).
- **Selection underline** (`box-shadow: inset 0 -2px 0 currentColor`): active nav item (ink), current move and chosen theme (pointer).

### The Studio (3D depth)
One warm spot lamp (#fff0dc, intensity 3.6, angle 0.5, penumbra 0.62) hangs over the player's left shoulder with soft VSM shadows; a dim hemisphere (#8fa596 over #0c140f, 0.34) and a room environment at 0.45 supply reflections per material; neutral tone mapping at exposure 1.04; clear colour stage-ground. Materials: lacquered mahogany frame (roughness 0.36, clearcoat 0.9), veneer squares (0.48, clearcoat 0.55), boxwood pieces (0.42, clearcoat 0.45), ebony pieces (0.28, clearcoat 1), felt (roughness 1). Camera angles: Si lojtar (the player's seat: straight behind your pieces, close, default), Nga lart (overhead), Afër tabelës (low three-quarter, the home page's orbit), each with a steeper upright-phone variant. In the seat view on an upright phone the felt beside the board is out of frame, so taken pieces lie well clear of the edge.

### Named Rules
**The Flat Graphics Rule.** Broadcast bars never cast shadows; only the table has light.

## Shapes

Square corners throughout the interface (0px): bars, buttons, cues, tools, bugs, tick marks, markers in the score bug and ticker are all squares. Borders are 1px hairlines, 1.5px for outlined buttons and segmented controls, 2px for section heads. Arrows are flat outlines with mitred joins, straight or bent like a knight's path, with a pointer disc carrying an ink number at the tail. The only curves are the turned 3D pieces and the frame's slightly rounded edge.

## Components

### Buttons
Outlined ink boxes; plain and confident.
- **Shape:** square (0px), 1.5px ink border, min-height 48px, width 108, weight 680.
- **Solid:** ink fill, stone text; hover mixes 14% ground in.
- **Hover / Focus / Active:** well fill on hover (fine pointers only); pointer focus ring with ground halo; scale 0.97 on press over 110ms.
- **Quiet:** borderless, 0.625rem inline padding.
- On the new-game sheet the same buttons invert to stone.

### Cues (broadcast actions)
Uppercase caps buttons inside the lower third: 1px stone border at 0.42 alpha, 44px high. The primary cue ("Shiko pse", the home "Luaj") is on: stone fill, ink text, white on hover. Quiet cues drop the border and underline.

### Tools
44px umber squares top right holding a Phosphor icon. On phones one menu button opens a list of labelled 48px rows (scale-in 160ms from the top right); on wide screens they become a row of icon squares with hidden labels. Pressed tools turn stone.

### Broadcast graphics (signature)
- **Live bug:** a pointer tag in caps with a blinking ink square (1.6s, two steps), joined to a stone status bar.
- **Score bug:** umber rows, a hollow square marker per player that fills with pointer on the side to move; captured pieces as small silhouettes and a material lead.
- **Lower third:** a pointer tag (TRAJNERI, ANALIZË in study) welded to a stone head that holds the move and verdict at poster size; an umber body with the reasons, a pointer-ink warning, and the cues. While the coach thinks, the move stands in outline (1.5px ink stroke) and the verdict inks it (320ms colour). Parts reveal by a left-to-right clip wipe (0.32s, 0.06s stagger, power3.out).
- **Ticker:** a rail of ticks, one per move, taller and louder the worse the move (3px plain to 13px pointer for a blunder; current move capped in stone), over a stone band crawling caps items separated by pointer squares (40s linear; pauses on hover, stops with motion off).
- **Intro card:** room-black card with the wordmark and a caps line on a pointer tag, wiped upward (0.5s power3.inOut).

### Navigation
Masthead: wordmark at width 125 weight 900, then (from 1024px) icon-and-label links at 560 that go 760 with a 2px ink underline when current; a motion switch at the right. Phone: fixed four-tab bar, icon over 0.8125rem label, current tab in text colour at 760 with a 2px bar on its top edge.

### Inputs
Segmented control: 1.5px stone border, 48px cells divided by 1.5px rules, checked cell filled stone with ink text. Choice rows and theme checkboxes use native inputs tinted with the pointer, separated by hairlines.

### Board
Two views of one set. The 3D board as above; the flat board is an SVG with mahogany frame, boxwood stringing, maple and walnut squares and inlaid coordinates, pieces as side profiles of the turned pieces. Marks: last move 20% pointer, check 42%, chosen 26%, focus 7px pointer ring, move dots 85%, captures as rings, keyboard cursor a dashed ink square. Pieces settle on springs (rest k170 c19, carry k560 c42) in 3D and slide 210ms in 2D; arrows draw on from the tail (3D 0.32s cubic out, numbers land after; 2D 260ms with the head at +200ms).

## Do's and Don'ts

### Do:
- **Do** put play, puzzle and home screens on the lit table and lay the interface over it as broadcast graphics.
- **Do** keep graphics to stone, ink and the umber bar family, with the pointer as the only hue; fill the pointer with ink text.
- **Do** rank type by width (125 for broadcast caps and posters, 100 for reading) and weight within Mona Sans.
- **Do** write moves in figurine notation and grade them with informant symbols set as type.
- **Do** keep every corner square and every tap target at least 44px (48px for primary buttons).
- **Do** route every animation through the GSAP ticker or CSS, and make the Stop-animations switch and reduced motion place pieces and arrows at once (transition-duration 0s, not 0.01ms).

### Don't:
- **Don't** build the flat green-and-cream board widget with a grey eval bar and a sidebar of tabs.
- **Don't** add badges or pills for verdicts; the verdict word and symbol are the interface.
- **Don't** use orange to mark the current move on the rail or as decoration.
- **Don't** add drop shadows or rounded corners to broadcast bars.
- **Don't** add a second typeface or set text as an icon glyph; icons are Phosphor regular SVG, one family, one weight.
- **Don't** give the table a light theme: felt, wood and pieces keep their tones in both system themes.
