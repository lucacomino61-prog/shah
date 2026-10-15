// The opponent's seat at the table: their face in the score capsule, a short line they say now and then in a
// speech capsule (on phones it takes the move strip's place for a few seconds, so nothing covers the board), and the
// signature moment: the player card chosen in the deck flies across to the seat and becomes the face.

import { line, portrait, type Moment } from '../lib/bots.ts';
import { motionOn } from './shell.ts';

const face = document.querySelector<HTMLImageElement>('[data-face]');
const bubble = document.querySelector<HTMLElement>('[data-say]');
const bubbleFace = bubble?.querySelector<HTMLImageElement>('[data-say-face]');
const bubbleText = bubble?.querySelector<HTMLElement>('[data-say-text]');

/** Who sits across: a level id, or null for a friend (no face). */
export function seat(id: number | null) {
  if (!face) return;
  face.hidden = id === null;
  if (id === null) return hush();
  const src = portrait(id);
  if (!face.src.endsWith(src)) face.src = src;
  if (bubbleFace && !bubbleFace.src.endsWith(src)) bubbleFace.src = src;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let outTimer: ReturnType<typeof setTimeout> | null = null;
/** the ply of the last thing said, so the opponent never chatters */
let lastPly = -99;

/** Say something at this moment. Lines other than the opening and closing ones keep a few moves apart. */
export function speak(id: number, moment: Moment, ply: number, chance = 1) {
  if (!bubble || !bubbleText) return;
  const always = moment === 'hello' || moment === 'won' || moment === 'lost' || moment === 'draw' || moment === 'resign';
  if (!always && (ply - lastPly < 4 || Math.random() > chance)) return;
  lastPly = ply;
  const text = line(id, moment);
  if (timer) clearTimeout(timer);
  if (outTimer) clearTimeout(outTimer);
  bubbleText.textContent = text;
  bubble.removeAttribute('data-out');
  bubble.hidden = false;
  // long enough to read twice at a calm pace, never less than three seconds
  const stay = always && moment !== 'hello' ? 6000 : Math.max(3000, 70 * text.length);
  timer = setTimeout(hush, stay);
}

/** The line fades out (an exit, so a tap that dismisses it is answered with a visible change). */
export function hush() {
  if (!bubble || bubble.hidden) return;
  if (timer) clearTimeout(timer);
  timer = null;
  bubble.setAttribute('data-out', '');
  outTimer = setTimeout(() => {
    bubble.hidden = true;
    bubble.removeAttribute('data-out');
  }, motionOn() ? 180 : 0);
}
bubble?.addEventListener('click', hush);

/** A new game: the next line may come at once. */
export function resetChatter() {
  lastPly = -99;
  hush();
}

/** The chosen card flies to the seat: a copy of its painting travels from where the card was to the face, shrinking
 *  and rounding as it goes, then hands over to the face. Resolves when the face is in place. */
export function fly(from: DOMRect | null, src: string): Promise<void> {
  if (!face || face.hidden || !from || !motionOn() || !from.width) return Promise.resolve();
  const to = face.getBoundingClientRect();
  if (!to.width) return Promise.resolve();
  const card = document.createElement('img');
  card.src = src;
  card.alt = '';
  card.className = 'seat-flight';
  Object.assign(card.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.append(card);
  const s = to.width / from.width;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  face.style.opacity = '0';
  const flight = card.animate(
    [
      { transform: 'translate(0, 0) scale(1)', borderRadius: '1.25rem', opacity: 1 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.5 - 24}px) scale(${(1 + s) / 2.4}) rotate(-4deg)`, borderRadius: '1.5rem', opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(${s})`, borderRadius: `${from.width}px`, opacity: 0.2 },
    ],
    { duration: 620, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', fill: 'forwards' },
  );
  return flight.finished
    .catch(() => {})
    .then(() => {
      card.remove();
      face.style.opacity = '';
      face.animate([{ transform: 'scale(1.25)', opacity: 0.4 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
    });
}
