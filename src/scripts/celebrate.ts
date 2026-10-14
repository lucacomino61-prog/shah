// Two small moments that happen rarely enough to deserve motion: the daily streak growing by a day (its number rolls
// up like an odometer, its flame jumps, a chime) and a piece arriving among the captured ones (it pops in). With the
// Stop-animations switch or reduced motion the number simply changes.

import { streakSound } from '../lib/sound.ts';
import { motionOn } from './shell.ts';

/** The streak grew from `from` to `to` days: roll the number, jump the flame. */
export function rollStreak(num: HTMLElement, from: number, to: number, flame?: Element | null) {
  if (to <= from || !motionOn()) {
    num.textContent = String(to);
    return;
  }
  num.innerHTML = `<span class="roll" aria-hidden="true"><span class="roll__out">${from}</span><span class="roll__in">${to}</span></span><span class="visually-hidden">${to}</span>`;
  num.querySelector('.roll__in')!.addEventListener('animationend', () => (num.textContent = String(to)), { once: true });
  if (flame) {
    flame.classList.remove('flame-jump');
    // restart the jump if it is already running
    void (flame as HTMLElement).getBoundingClientRect();
    flame.classList.add('flame-jump');
    flame.addEventListener('animationend', () => flame.classList.remove('flame-jump'), { once: true });
  }
  streakSound();
}

type Counts = Record<string, number>;
/**
 * The captured pieces a side shows, drawn again on every move: the ones that were there before stay still and the
 * new ones pop in. `seen` keeps the last counts per row between calls.
 */
export function takenIcons(seen: Map<string, Counts>, row: string, victim: 'w' | 'b', counts: Counts): string {
  const before = seen.get(row) ?? {};
  // the first drawing (a game picked up again) and fewer than before (a take-back, a new game): nothing pops
  const grew = seen.has(row) && Object.keys(counts).some((k) => (counts[k] ?? 0) > (before[k] ?? 0)) && !Object.keys(before).some((k) => (counts[k] ?? 0) < before[k]);
  let html = '';
  for (const k of ['q', 'r', 'b', 'n', 'p']) {
    const n = counts[k] ?? 0;
    for (let i = 0; i < n; i++) html += `<svg class="cap${grew && i >= (before[k] ?? 0) ? ' cap--in' : ''}" aria-hidden="true"><use href="#pc-${victim}-${k}"/></svg>`;
  }
  seen.set(row, { ...counts });
  return html;
}

/** Write a captured-pieces row only when what it shows changed, so a piece popping in is not cut short by the next
 *  drawing of the same row. */
export function writeTaken(el: Element, html: string) {
  const sig = html.replace(/ cap--in/g, '');
  const box = el as HTMLElement;
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = html;
}
