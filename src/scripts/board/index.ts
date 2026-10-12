// Picks the board a page shows (marble in 3D when WebGL works, flat otherwise) and gives it a keyboard path:
// the board takes focus, the arrows move a cursor, Enter or Space presses the square, Escape lets go.

import { createBoard2d } from './board2d.ts';
import type { BoardOptions, BoardView, Side, Sq } from './types.ts';
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
      const { createBoard3d } = await import('./board3d.ts');
      return createBoard3d(o);
    } catch (e) {
      console.warn('3D board failed, using the flat one', e);
    }
  }
  o.host.dataset.kind = '2d';
  return createBoard2d(o);
}

/**
 * On a phone the lower third sits over the table and grows when the coach says more: keep the board in the
 * space above it. On a wide screen the graphics have their own column and CSS sets the margins.
 */
export function followBroadcast(host: HTMLElement, lower: HTMLElement, view: () => BoardView | undefined) {
  const narrow = window.matchMedia('(max-width: 1023px)');
  let last = -1;
  const apply = () => {
    if (!narrow.matches) {
      if (last !== -1) {
        host.style.removeProperty('--inset-bottom');
        last = -1;
        view()?.refit?.();
      }
      return;
    }
    const stage = host.parentElement!.getBoundingClientRect();
    const px = Math.round(stage.bottom - lower.getBoundingClientRect().top + 10);
    if (Math.abs(px - last) < 16) return;
    last = px;
    host.style.setProperty('--inset-bottom', `${px}px`);
    view()?.refit?.();
  };
  new ResizeObserver(apply).observe(lower);
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
