# Where every picture and font comes from

Every raster the app ships, with its source and licence. Nothing here shows a real person.

## The opponents' portraits (`public/bots/`)

Nine oil-painting portraits, one per opponent, of **invented people** (no real model, no likeness requested). Generated on
2026-10-15 with GPT Image 2.5 through Higgsfield (Luca's account, 0.25 credits each), 896 x 1120 PNG, then cut by
`tools/bot-portraits.mjs` into a 4:5 card in two widths (`<id>-320.webp`, `<id>-560.webp`) and a square face
(`<id>-face.webp`, 192 px). Each WebP carries this origin in its EXIF description.

Every prompt was the same frame with a different subject:

> Oil painting portrait on canvas, the kind that hangs in an old chess club's gallery of members. Subject: *(below)*.
> Chest-up, three-quarter view, looking at the viewer, head in the upper half of the frame with space above. Visible
> confident brushwork and soft glazes, warm amber lamplight from the upper left, deep warm umber background with a
> faint glow behind the head. Painterly, not photographic. No text, no frame, no signature, no chess pieces.

| File | Opponent | Subject in the prompt |
| --- | --- | --- |
| lea | Lea, level 1 | an Albanian girl about eleven years old, dark brown hair in a loose ponytail, bright curious eyes, a small shy smile, navy school cardigan over a white collar |
| ermali | Ermali, level 2 | an Albanian teenage boy about fifteen, tousled black hair, a mischievous grin, eyebrows raised, charcoal grey hoodie |
| arta | Arta, level 3 | an Albanian young woman in her early twenties, a university student, auburn-brown hair tied back, thin round glasses, a thoughtful half smile, mustard knit sweater |
| agimi | Agimi, level 4 | an Albanian man in his mid thirties, short dark beard, warm friendly eyes, relaxed open smile, faded denim shirt |
| drita | Drita, level 5 | an Albanian woman in her mid forties, shoulder-length dark hair with a few grey strands, calm attentive expression, olive green blouse, small gold earrings |
| besniku | Besniku, level 6 | an Albanian man around sixty, a club regular, silver moustache, tweed flat cap, brown tweed jacket over a cream shirt, a wry knowing smile |
| teuta | Teuta, level 7 | an Albanian woman around thirty, black hair in a sleek low bun, sharp confident direct gaze, the faintest smile, black turtleneck, a thin silver chain |
| ardiani | Ardiani, level 8 | an elderly Albanian man around seventy-five, an old master of the club, white hair swept back, deep-set wise eyes, serene composed expression, dark charcoal suit, burgundy tie |
| stockfish | Stockfish, level 9 | a nineteenth-century chess-playing automaton: a smooth pale porcelain face with calm painted features and glass eyes, polished brass collar and shoulder plates, a small window in the chest showing clockwork gears, carved walnut details; no turban, no costume |

Regenerate: run the same prompts (aspect 4:5), save them as `0-lea.png` … `8-stockfish.png` in one folder, then
`node tools/bot-portraits.mjs <folder>`. The face crops are set per portrait in that script.

## The rooms behind the reading pages (`public/rooms/`)

Eight stills of the app's own three.js table, one upright (`<room>-tall.webp`, 720 px wide) and one wide
(`<room>-wide.webp`, 1600 px) per room, photographed from the live home page with the interface hidden and softened
by a light blur (`tools/room-backdrops.mjs`, dev server running). They contain only what the scene renders: the Poly
Haven CC0 HDRIs and textures (see the README) and the app's own models.

## The title face (`public/fonts/`)

Bodoni Moda by Owen Earl (Indestructible Type), SIL Open Font License 1.1 (`public/fonts/OFL.txt`). The two files are
the Latin subsets Google Fonts serves (roman and italic, weight and optical-size axes), downloaded 2026-10-15.

## Already recorded elsewhere

- `public/realism/`: veneers, table woods, velvet and room HDRIs from Poly Haven (CC0); the knight mesh generated on
  Higgsfield (README, "Realism assets").
- `public/og.png` and the app icons: rendered from the app itself by `tools/make-icons.mjs`.
