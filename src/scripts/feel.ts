// How the app feels in the hand (Luca, 2026-10-15: "make the buttons with animation … scroll animation, make everything
// more like an application"): a light where the finger presses a control and a spring as it lets go, a haptic tick on
// the taps that matter, a tab bar that tucks itself away while a page scrolls down, sheets that close with a swipe,
// and figures that count up the first time they show. No loop of its own: pointer and scroll events, CSS and the Web
// Animations API (GSAP's ticker stays the only requestAnimationFrame owner, for the count-up too).

import { haptic } from '../lib/sound.ts';
import { gsap, motionOn } from './shell.ts';

const root = document.documentElement;

/** Everything that presses: the light and the spring apply to all of them. */
export const PRESSABLE =
  '.btn, .cue, .tool, .look-open, .streak, .tabs a, .mast__nav a, .motion-switch, .dash__opp, .dash__tile, .stop__link, .pick, .tile, .deck__step, .unbox__cue, a.row, button.row, label.row, .choice';

/** The taps that deserve a tick: moving between tabs, the primary actions, a choice in a deck or a picker. */
const TICK = '.tabs a, .mast__nav a, .btn--solid, .cue--on, .dash__opp, .tool--menu, .look-open';

function press() {
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || !motionOn()) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(PRESSABLE);
      if (!el || (el as HTMLButtonElement).disabled) return;
      const r = el.getBoundingClientRect();
      // the light: a soft glow under the finger, behind the label (the control is its own stacking context)
      const glow = document.createElement('span');
      glow.className = 'press-glow';
      glow.style.setProperty('--x', `${e.clientX - r.left}px`);
      glow.style.setProperty('--y', `${e.clientY - r.top}px`);
      glow.style.setProperty('--r', `${Math.max(r.width, r.height) * 1.1}px`);
      el.append(glow);
      glow.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, easing: 'ease-out', fill: 'forwards' });
      const release = () => {
        el.removeEventListener('pointerup', release);
        el.removeEventListener('pointercancel', release);
        el.removeEventListener('pointerleave', release);
        glow.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 420, easing: 'ease-out', fill: 'forwards' }).finished.then(() => glow.remove(), () => glow.remove());
        // the spring as it lets go: past its size, then home (the press itself is the CSS :active scale)
        el.animate([{ scale: '1' }, { scale: '1.035', offset: 0.4 }, { scale: '1' }], { duration: 380, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
    },
    { passive: true },
  );
  document.addEventListener('click', (e) => {
    const el = (e.target as Element | null)?.closest(TICK);
    if (el) haptic(6);
  });
  // a new choice in a deck or a picker: a lighter tick
  document.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.type === 'radio') haptic(4);
  });
}

/** The tab bar tucks itself smaller while the page scrolls down, and comes back as soon as it scrolls up. */
function tabsTuck() {
  let last = scrollY;
  addEventListener(
    'scroll',
    () => {
      const y = scrollY;
      if (Math.abs(y - last) < 8) return;
      root.toggleAttribute('data-tabs-min', y > last && y > 140);
      last = y;
    },
    { passive: true },
  );
}

/** Sheets close with a swipe down from their grabber or title (phones, where they rise from the bottom). A flick is
 *  enough: a fast swipe closes it whatever the distance; dragging up meets friction. */
function sheets() {
  const narrow = matchMedia('(max-width: 639px)');
  document.querySelectorAll<HTMLDialogElement>('dialog.setup').forEach((d) => {
    const grab = document.createElement('div');
    grab.className = 'sheet-grab';
    grab.setAttribute('aria-hidden', 'true');
    d.prepend(grab);
    const handles = [grab, ...d.querySelectorAll<HTMLElement>('.setup__title, .welcome__k, .welcome__title')];
    let y0 = 0;
    let t0 = 0;
    let dy = 0;
    let on = false;
    const set = (y: number) => {
      d.style.translate = `0 ${y}px`;
      d.style.setProperty('--drag', String(Math.max(0, Math.min(1, y / d.offsetHeight))));
    };
    for (const h of handles) {
      h.style.touchAction = 'none';
      h.addEventListener('pointerdown', (e) => {
        if (!narrow.matches || e.button !== 0) return;
        on = true;
        y0 = e.clientY;
        t0 = e.timeStamp;
        dy = 0;
        h.setPointerCapture(e.pointerId);
        d.style.transition = 'none';
      });
      h.addEventListener('pointermove', (e) => {
        if (!on) return;
        const raw = e.clientY - y0;
        // up past the rest position meets friction, as the real thing does
        dy = raw > 0 ? raw : raw * 0.18;
        set(dy);
      });
      const end = (e: PointerEvent) => {
        if (!on) return;
        on = false;
        const v = dy / Math.max(1, e.timeStamp - t0);
        d.style.transition = '';
        if (dy > d.offsetHeight * 0.28 || (v > 0.11 && dy > 24)) {
          haptic(6);
          // the close transition carries it on down from where the finger left it
          d.style.translate = '';
          d.style.removeProperty('--drag');
          d.dispatchEvent(new Event('cancel'));
          d.close();
        } else {
          d.style.translate = '';
          d.style.removeProperty('--drag');
        }
      };
      h.addEventListener('pointerup', end);
      h.addEventListener('pointercancel', end);
    }
  });
}

const counted = new WeakSet<Element>();
const counting = new WeakMap<Element, gsap.core.Tween>();
/** A figure is about to be written directly (a redraw after sync): its count, if still running, stops here. */
export function settle(el: Element) {
  counting.get(el)?.kill();
  counting.delete(el);
}
/** A figure counts up the first time it shows (once a page; at once with motion off). */
export function countUp(el: HTMLElement, to: number, suffix = '') {
  if (counted.has(el) || !motionOn() || to <= 0) {
    el.textContent = `${to}${suffix}`;
    return;
  }
  counted.add(el);
  const o = { v: 0 };
  el.textContent = `0${suffix}`;
  counting.set(el, gsap.to(o, { v: to, duration: 0.9, delay: 0.15, ease: 'power3.out', onUpdate: () => (el.textContent = `${Math.round(o.v)}${suffix}`), onComplete: () => counting.delete(el) }));
}

export function initFeel() {
  press();
  tabsTuck();
  sheets();
}
