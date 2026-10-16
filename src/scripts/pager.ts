// A screen of pages side by side, as an app pages through them (Luca, 2026-10-16: no page scrolls but the settings):
// the pages swipe sideways and snap, a row of tabs above names them and follows the swipe, a tap on a tab slides to
// its page, the arrow keys move along the tabs. The page in view is marked [data-shown], so its contents can arrive
// (styles/feel.css) the first time it shows.
//   <div role="tablist" data-pager-tabs="name"><button role="tab" data-pager-tab="0">…</button>…</div>
//   <div class="pager" data-pager="name"><section class="pager__page">…</section>…</div>

import { motionOn } from './shell.ts';

export interface Pager {
  go(i: number, smooth?: boolean): void;
  readonly index: number;
}

const pagers = new Map<string, Pager>();
export const pagerOf = (name: string) => pagers.get(name);

function make(box: HTMLElement): Pager {
  const name = box.dataset.pager!;
  const pages = [...box.querySelectorAll<HTMLElement>(':scope > .pager__page')];
  const tabs = [...document.querySelectorAll<HTMLElement>(`[data-pager-tabs="${name}"] [data-pager-tab]`)];
  const list = document.querySelector<HTMLElement>(`[data-pager-tabs="${name}"]`);
  let index = -1;
  const mark = (i: number) => {
    if (i === index || i < 0 || i >= pages.length) return;
    index = i;
    // side by side on a wide screen every page is in view; paged, only the current one is there for the keyboard
    const paged = getComputedStyle(box).overflowX !== 'visible';
    pages.forEach((p, k) => {
      p.toggleAttribute('data-current', k === i);
      p.inert = paged && k !== i;
    });
    pages[i].setAttribute('data-shown', '');
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
    });
    // the tab row keeps its chosen tab in view (it scrolls sideways on a narrow phone)
    const t = tabs[i];
    if (t && list && list.scrollWidth > list.clientWidth) list.scrollTo({ left: t.offsetLeft - (list.clientWidth - t.offsetWidth) / 2, behavior: motionOn() ? 'smooth' : 'instant' });
    box.dispatchEvent(new CustomEvent('pager:change', { detail: i }));
  };
  const go = (i: number, smooth = true) => {
    const p = pages[Math.max(0, Math.min(pages.length - 1, i))];
    if (!p) return;
    box.scrollTo({ left: p.offsetLeft, behavior: smooth && motionOn() ? "smooth" : "instant" });
    mark(pages.indexOf(p));
  };
  // the page more than half in view is the current one (a read and a compare: no frame of its own, GSAP's ticker
  // stays the one clock)
  box.addEventListener('scroll', () => mark(Math.round(box.scrollLeft / (box.clientWidth || 1))), { passive: true });
  tabs.forEach((t, k) => t.addEventListener('click', () => go(k)));
  list?.addEventListener('keydown', (e) => {
    // across a row of tabs, or down a list of them (the course's side list on a wide screen)
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    go(index + d);
    tabs[index]?.focus();
  });
  mark(0);
  return {
    go,
    get index() {
      return index;
    },
  };
}

/** Made once each: a page's own script may call it first to choose where its pager opens. */
export function initPagers() {
  document.querySelectorAll<HTMLElement>('[data-pager]').forEach((box) => {
    if (!pagers.has(box.dataset.pager!)) pagers.set(box.dataset.pager!, make(box));
  });
}
