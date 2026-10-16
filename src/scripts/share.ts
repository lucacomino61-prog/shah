// Share cards: a picture of a moment in the app (today's puzzle solved, a game won, the medals) for WhatsApp or
// Instagram. Drawn in the browser on a canvas (no server sees anything), handed to the phone's share sheet, or saved
// as a file where there is no share sheet for pictures (a computer).

import { miniBoard } from '../lib/miniboard.ts';
import { pieceSprite } from '../lib/chess/silhouette.ts';

export interface Card {
  /** the small brass word over the title */
  kicker: string;
  title: string;
  line: string;
  /** a position to print as a diagram */
  fen?: string;
  side?: 'w' | 'b';
  marks?: string[];
  /** instead of a diagram: medals, earned first */
  medals?: { earned: number; total: number };
}

const W = 1080;
const H = 1350;
const INK = '#f5efe6';
const BRASS = '#e2c48c';
const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DIDONE = '"Bodoni Moda", "Bodoni 72", Didot, Georgia, serif';

/** The page's diagram as a picture of its own: the sprite's pieces written in, the colours set. */
function diagramSvg(fen: string, side: 'w' | 'b', marks: string[]): string {
  const colours: Record<string, string> = { '--piece-fill-w': '#f6f4ee', '--piece-edge-w': '#111214', '--piece-fill-b': '#17181b', '--piece-edge-b': '#f1efe9' };
  const sprite = pieceSprite().replace(/var\((--piece-[a-z-]+)\)/g, (_, v: string) => colours[v] ?? '#000');
  const defs = sprite.slice(sprite.indexOf('<defs>'), sprite.indexOf('</defs>') + 7);
  return miniBoard(fen, { side, marks })
    .replace('<svg class="mini" ', '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" ')
    .replace('focusable="false">', `focusable="false">${defs}`)
    .replace('class="mini__l"', 'fill="#ead3a6"')
    .replace('class="mini__d"', 'fill="#8d5338"')
    .replace('class="mini__mark"', 'fill="#ffd60a" fill-opacity="0.5"');
}

function image(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

/** Lines of text that fit a width, at most `max` of them (the last one ends with … when cut). */
function wrap(g: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (g.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = kept[max - 1].replace(/\s*\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

async function draw(card: Card): Promise<Blob> {
  await Promise.all([document.fonts.load(`600 120px "Bodoni Moda"`), document.fonts.load(`600 72px "Bodoni Moda"`)]).catch(() => {});
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // the room: dark wood with a warm pool of lamp light
  const bg = g.createRadialGradient(W * 0.5, H * 0.55, 80, W * 0.5, H * 0.55, H * 0.85);
  bg.addColorStop(0, '#4a2e1c');
  bg.addColorStop(0.55, '#21150d');
  bg.addColorStop(1, '#0b0705');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'alphabetic';
  // the mark
  g.fillStyle = INK;
  g.font = `600 128px ${DIDONE}`;
  g.fillText('Shah', 80, 200);
  // the kicker in brass, the title in the Didone, the line in the system face
  g.fillStyle = BRASS;
  g.font = `700 34px ${SANS}`;
  g.fillText(card.kicker.toUpperCase(), 84, 286);
  g.fillStyle = INK;
  g.font = `600 72px ${DIDONE}`;
  let y = 370;
  for (const l of wrap(g, card.title, W - 168, 2)) {
    g.fillText(l, 80, y);
    y += 82;
  }
  g.fillStyle = 'rgba(245, 239, 230, 0.78)';
  g.font = `500 38px ${SANS}`;
  for (const l of wrap(g, card.line, W - 168, 2)) {
    g.fillText(l, 84, y);
    y += 50;
  }
  const top = Math.max(y + 24, 600);
  const size = Math.min(640, H - 120 - top);
  const left = (W - size) / 2;
  if (card.fen) {
    // the diagram in its rosewood frame and pale stringing, as the board itself
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.6)';
    g.shadowBlur = 50;
    g.shadowOffsetY = 18;
    g.fillStyle = '#3b1a0e';
    g.fillRect(left - 22, top - 22, size + 44, size + 44);
    g.restore();
    g.fillStyle = 'rgba(233, 211, 164, 0.55)';
    g.fillRect(left - 8, top - 8, size + 16, size + 16);
    const img = await image(diagramSvg(card.fen, card.side ?? 'w', card.marks ?? []));
    g.drawImage(img, left, top, size, size);
  } else if (card.medals) {
    // the medals case: struck brass for those earned, an engraved ring for the rest
    const { earned, total } = card.medals;
    const cols = 4;
    const r = 58;
    const gap = (size - cols * r * 2) / (cols - 1);
    for (let i = 0; i < total; i++) {
      const cx = left + r + (i % cols) * (r * 2 + gap);
      const cy = top + r + Math.floor(i / cols) * (r * 2 + 36);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      if (i < earned) {
        const disc = g.createRadialGradient(cx - r * 0.32, cy - r * 0.44, 4, cx, cy, r);
        disc.addColorStop(0, '#fff5d6');
        disc.addColorStop(0.16, '#efd08a');
        disc.addColorStop(0.5, '#c39443');
        disc.addColorStop(0.78, '#8a5f24');
        disc.addColorStop(1, '#5d3d14');
        g.fillStyle = disc;
        g.fill();
      } else {
        g.strokeStyle = 'rgba(226, 196, 140, 0.35)';
        g.lineWidth = 4;
        g.stroke();
      }
    }
  }
  // the way to the app
  g.fillStyle = 'rgba(245, 239, 230, 0.7)';
  g.font = `500 32px ${SANS}`;
  const foot = `Trajner shahu në shqip · ${location.host}`;
  g.fillText(foot, (W - g.measureText(foot).width) / 2, H - 52);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('no picture'))), 'image/png'));
}

/** Draw the card and hand it on: the share sheet with the picture where the phone has one, otherwise a saved file. */
export async function shareCard(card: Card, text: string): Promise<'shared' | 'saved' | 'cancelled'> {
  const blob = await draw(card);
  const file = new File([blob], 'shah.png', { type: 'image/png' });
  const url = `${location.origin}/`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'shah.png';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'saved';
}
