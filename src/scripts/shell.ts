// What every page shares: the Stop-animations switch, the one clock and sync between phones (when it is on).
// GSAP's ticker owns requestAnimationFrame; the boards and every timed effect step from it.

import { gsap } from 'gsap';
import { autoSync } from '../lib/sync.ts';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const listeners = new Set<(on: boolean) => void>();

/** Motion is allowed: the switch is on and the system does not ask for less. */
export const motionOn = () => root.dataset.motion !== 'off' && !reduced.matches;

export function onMotion(fn: (on: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setMotion(on: boolean) {
  root.dataset.motion = on ? 'on' : 'off';
  try {
    localStorage.setItem('shah.motion', on ? 'on' : 'off');
  } catch {
    /* the choice lasts for this page only */
  }
  document.querySelectorAll<HTMLButtonElement>('[data-motion-switch]').forEach((b) => b.setAttribute('aria-pressed', on ? 'false' : 'true'));
  gsap.globalTimeline.timeScale(on ? 1 : 1000);
  listeners.forEach((fn) => fn(motionOn()));
}

export function initShell() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('shah.motion');
  } catch {
    /* private mode */
  }
  setMotion(stored !== 'off');
  document.querySelectorAll<HTMLButtonElement>('[data-motion-switch]').forEach((b) =>
    b.addEventListener('click', () => setMotion(root.dataset.motion === 'off')),
  );
  reduced.addEventListener('change', () => listeners.forEach((fn) => fn(motionOn())));
  // the tool menu on a phone stage: opens a labelled list, closes on a choice, outside, or Escape
  document.querySelectorAll<HTMLButtonElement>('[data-tools-toggle]').forEach((btn) => {
    const box = btn.closest<HTMLElement>('.tools')!;
    const set = (open: boolean) => {
      box.toggleAttribute('data-open', open);
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => set(!box.hasAttribute('data-open')));
    box.querySelector('.tools__list')?.addEventListener('click', (e) => {
      // a choice closes the menu; one that asks to be pressed again (Dorëzohu) keeps it open for the second press
      const t = (e.target as Element).closest('.tool');
      if (t && !t.hasAttribute('data-keep-open')) set(false);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!box.contains(e.target as Node)) set(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && box.hasAttribute('data-open')) {
        set(false);
        btn.focus();
      }
    });
  });
  gsap.ticker.lagSmoothing(0);
  autoSync();
}

/** Step something every frame from the shared clock; returns the way to stop. */
export function onTick(fn: (seconds: number) => void) {
  const cb = (_time: number, deltaMs: number) => fn(deltaMs / 1000);
  gsap.ticker.add(cb);
  return () => gsap.ticker.remove(cb);
}

export { gsap };
