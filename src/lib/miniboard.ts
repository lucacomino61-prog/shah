// A small diagram of a position, the way chess books print one: the board in its two woods and the pieces from the
// page's sprite (lib/chess/silhouette.ts, drawn once in the layout). The same function runs at build time (the
// lessons' path) and in the browser (today's puzzle on the home screen).

const FILES = 'abcdefgh';

export interface MiniOptions {
  /** the side at the bottom */
  side?: 'w' | 'b';
  /** squares to mark, e.g. the last move */
  marks?: string[];
  /** the spoken description; without it the diagram is decorative */
  label?: string;
}

export function miniBoard(fen: string, { side = 'w', marks = [], label }: MiniOptions = {}): string {
  const rows = fen.split(' ')[0].split('/');
  let squares = '';
  let pieces = '';
  for (let r = 0; r < 8; r++) {
    let f = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        f += Number(ch);
        continue;
      }
      const x = side === 'w' ? f : 7 - f;
      const y = side === 'w' ? r : 7 - r;
      const colour = ch === ch.toUpperCase() ? 'w' : 'b';
      // the silhouettes are tall and narrow: a diagram sets them larger than their square, base on its foot
      pieces += `<use href="#pc-${colour}-${ch.toLowerCase()}" x="${x * 100 - 14}" y="${y * 100 - 26}" width="128" height="128"/>`;
      f++;
    }
  }
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) if ((x + y) % 2) squares += `M${x * 100} ${y * 100}h100v100h-100z`;
  const marked = marks
    .map((sq) => {
      const f = FILES.indexOf(sq[0]);
      const r = 8 - Number(sq[1]);
      const x = side === 'w' ? f : 7 - f;
      const y = side === 'w' ? r : 7 - r;
      return `M${x * 100} ${y * 100}h100v100h-100z`;
    })
    .join('');
  const a11y = label ? `role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : 'aria-hidden="true"';
  return (
    `<svg class="mini" viewBox="0 0 800 800" ${a11y} focusable="false">` +
    `<rect width="800" height="800" class="mini__l"/><path d="${squares}" class="mini__d"/>` +
    (marked ? `<path d="${marked}" class="mini__mark"/>` : '') +
    pieces +
    `</svg>`
  );
}
