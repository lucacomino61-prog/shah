// Picks the board a page shows (marble in 3D when WebGL works, flat otherwise) and gives it a keyboard path:
// the board takes focus, the arrows move a cursor, Enter or Space presses the square, Escape lets go.

import { Chess } from 'chess.js';
import { onTick } from '../shell.ts';
import { createBoard2d } from './board2d.ts';
import type { BoardOptions, BoardView, Side, Sq } from './types.ts';
import type { PieceSetId, WorldId } from './looks.ts';
import { FILES } from './types.ts';

export type { BoardView } from './types.ts';

function webgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export async function createBoard(kind: '3d' | '2d', o: BoardOptions): Promise<BoardView> {
  o.host.dataset.kind = kind;
  if (kind === '3d' && webgl()) {
    try {
      // the board and its real-world materials load side by side; without the materials it keeps its drawn ones
      const [{ createBoard3d }, { loadRealism }, { chosenWorld }] = await Promise.all([import('./board3d.ts'), import('./realism.ts'), import('./looks.ts')]);
      const view = createBoard3d(o, await loadRealism(chosenWorld()));
      // a change of room or set in Pamja reaches the board that is out
      const onLook = (e: Event) => {
        const d = (e as CustomEvent<{ world: WorldId; pieces: PieceSetId }>).detail;
        view.setWorld?.(d.world);
        view.setPieces?.(d.pieces);
      };
      window.addEventListener('shah:look', onLook);
      const dispose = view.dispose.bind(view);
      view.dispose = () => {
        window.removeEventListener('shah:look', onLook);
        dispose();
      };
      return view;
    } catch (e) {
      console.warn('3D board failed, using the flat one', e);
    }
  }
  o.host.dataset.kind = '2d';
  return createBoard2d(o);
}

/**
 * On a phone the coach card sits over the table under the board. The board keeps one place for the whole game,
 * lesson or puzzle (Luca, 2026-10-14: "make the board to not move"): the card gets a fixed band below it, sized once
 * from the screen, and never grows past it (--card-max; its reasons scroll inside when the coach says more). Only a
 * new screen size moves the board. On a wide screen the card has its own column and CSS sets the margins.
 */
export function keepBoardStill(host: HTMLElement, lower: HTMLElement, view: () => BoardView | undefined) {
  const narrow = window.matchMedia('(max-width: 1023px)');
  const stageEl = host.parentElement!;
  let last = -1;
  const apply = () => {
    if (!narrow.matches) {
      if (last !== -1) {
        host.style.removeProperty('--inset-bottom');
        lower.style.removeProperty('--card-max');
        lower.removeAttribute('data-tight');
        last = -1;
        view()?.refit?.();
      }
      return;
    }
    const stage = stageEl.getBoundingClientRect();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const topValue = getComputedStyle(host).getPropertyValue('--inset-top').trim();
    const top = (parseFloat(topValue) || 0) * (topValue.endsWith('rem') ? rem : 1);
    // the card's foot: its distance from the bottom of the stage (above the tab bar)
    const foot = parseFloat(getComputedStyle(lower).bottom) || 0;
    const room = stage.height - top - foot;
    // the board fills the width of a phone and stands about as tall as it is wide; the card takes what is left,
    // between a compact verdict and a long one
    const band = Math.round(Math.min(15 * rem, Math.max(10.5 * rem, room - stage.width * 1.02 - 12)));
    const px = Math.round(foot + band + 10);
    if (px === last) return;
    last = px;
    lower.style.setProperty('--card-max', `${band}px`);
    // a short band (a small phone): the end of a game puts its buttons first
    lower.toggleAttribute('data-tight', band < 13 * rem);
    host.style.setProperty('--inset-bottom', `${px}px`);
    view()?.refit?.();
  };
  // the stage's size, not the card's: what the coach says never moves the board
  new ResizeObserver(apply).observe(stageEl);
  narrow.addEventListener('change', apply);
  apply();
}

/** Keyboard play on a focused board. `side` gives the direction "up" means for the player. */
export function keyboard(host: HTMLElement, view: () => BoardView, side: () => Side, onCursor?: (sq: Sq) => void) {
  let cursor: Sq | null = null;
  const move = (s: Sq, df: number, dr: number): Sq => {
    const k = side() === 'w' ? 1 : -1;
    const f = Math.max(0, Math.min(7, FILES.indexOf(s[0]) + df * k));
    const r = Math.max(1, Math.min(8, Number(s[1]) + dr * k));
    return FILES[f] + r;
  };
  host.addEventListener('focus', () => {
    if (!cursor) cursor = side() === 'w' ? 'e2' : 'e7';
    view().setCursor(cursor);
    onCursor?.(cursor);
  });
  host.addEventListener('blur', () => view().setCursor(null));
  host.addEventListener('keydown', (e) => {
    if (!cursor) cursor = side() === 'w' ? 'e2' : 'e7';
    const steps: Record<string, [number, number]> = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (steps[e.key]) {
      e.preventDefault();
      cursor = move(cursor, ...steps[e.key]);
      view().setCursor(cursor);
      onCursor?.(cursor);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      view().press(cursor);
      return;
    }
    if (e.key === 'Escape' && view().chosen) {
      e.preventDefault();
      view().press(view().chosen!);
    }
  });
}

/**
 * Mate on the board: once the mating piece has landed, the mated king goes over, away from it. `still` gives the
 * position the page shows at that moment; if it has moved on (a take-back, the next puzzle) the king stays up.
 */
export function mateFall(view: () => BoardView | undefined, fen: string, still: () => string) {
  const c = new Chess(fen);
  if (!c.isCheckmate()) return;
  const king = c.board().flat().find((p) => p && p.type === 'k' && p.color === c.turn());
  if (!king) return;
  // the king falls away from the piece that mates it
  const by = c.attackers(king.square, c.turn() === 'w' ? 'b' : 'w')[0];
  const placement = (f: string) => f.split(' ')[0];
  const t0 = performance.now();
  const stop = onTick(() => {
    const b = view();
    if (!b?.topple) return stop();
    if (b.busy && performance.now() - t0 < 1500) return;
    stop();
    if (placement(still()) === placement(fen)) b.topple(king.square, by);
  });
}
