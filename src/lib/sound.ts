// The sounds of the table, made in the browser (no files to fetch, so they work offline): a wooden click when a
// piece is set down, a heavier knock for a capture, a soft two-note chime for check, a short rising phrase when a
// game or a puzzle is won; the case's hinge and its landing, a knock for each piece laid out, a mated king's thud, a
// promotion's two notes, the streak's chime. Android also vibrates; an iPhone has no Vibration API, so a hidden
// switch gives its haptic tick where Safari allows it (during a touch). The Sound switch turns all of it off.

import { load } from './store.ts';

let ctx: AudioContext | null = null;

/** Browsers start audio only after a gesture: the first touch or key on the page wakes it. */
function wake() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // the home page wakes one inside a tap that comes before this script has loaded (a slow connection)
    ctx = (window as unknown as { __shahAudio?: AudioContext }).__shahAudio ?? new AC();
  } catch {
    ctx = null;
  }
}
if (typeof window !== 'undefined') {
  const once = () => {
    wake();
    if (ctx?.state === 'suspended') void ctx.resume();
  };
  addEventListener('pointerdown', once, { passive: true });
  // Safari unlocks audio on the end of a touch or a click, not its start
  addEventListener('touchend', once, { passive: true });
  addEventListener('click', once);
  addEventListener('keydown', once);
  // made while the page is idle, so the first touch does not wait the 60 ms it takes; it starts suspended and the
  // first gesture lets it play
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500));
  idle(() => {
    try {
      if (load().sound) wake();
    } catch {
      /* it wakes at the first touch instead */
    }
  });
}

const on = () => load().sound;

/** A knock of wood: a short burst of filtered noise over a low thump. */
function knock(at: number, pitch: number, gain: number) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = pitch;
  band.Q.value = 3.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.001, at + 0.07);
  noise.connect(band).connect(g).connect(ctx.destination);
  noise.start(at);
  const body = ctx.createOscillator();
  body.type = 'sine';
  body.frequency.setValueAtTime(pitch / 9, at);
  body.frequency.exponentialRampToValueAtTime(pitch / 16, at + 0.06);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(gain * 0.7, at);
  bg.gain.exponentialRampToValueAtTime(0.001, at + 0.08);
  body.connect(bg).connect(ctx.destination);
  body.start(at);
  body.stop(at + 0.09);
}

/** A soft bell tone. */
function tone(at: number, freq: number, dur: number, gain: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** iPhones have no Vibration API; Safari 18 gives a haptic tick when a switch control is flipped, so a hidden switch
 *  stands in (it can only tick while the page is answering a touch). */
let tickLabel: HTMLLabelElement | null = null;
function iosTick() {
  if (!tickLabel) {
    tickLabel = document.createElement('label');
    tickLabel.setAttribute('aria-hidden', 'true');
    tickLabel.style.cssText = 'position:fixed;left:-9px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    tickLabel.append(input);
    document.body.append(tickLabel);
  }
  tickLabel.click();
}

const buzz = (pattern: number | number[]) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
    else if (/iPhone|iPad|iPod/.test(navigator.userAgent)) iosTick();
  } catch {
    /* not allowed here */
  }
};

/** A short vibration on its own (the Sound switch covers vibration too). */
export function haptic(pattern: number | number[] = 10) {
  if (on()) buzz(pattern);
}

/** The sound of one move, read from its notation: x a capture, + check, # mate. */
export function moveSound(san: string) {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.01 : 0;
  if (san.includes('x')) {
    knock(t, 1100, 0.55);
    knock(t + 0.045, 760, 0.45);
    buzz([12, 30, 12]);
  } else {
    knock(t, 1500, 0.4);
    buzz(10);
  }
  if (san.includes('+') || san.includes('#')) {
    tone(t + 0.08, 880, 0.35, 0.12);
    tone(t + 0.2, 1175, 0.45, 0.1);
  }
}

/** A won game or a solved puzzle: three rising notes. */
export function winSound() {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.02 : 0;
  [659, 784, 1047].forEach((f, i) => tone(t + i * 0.11, f, 0.5, 0.1));
  buzz([20, 40, 20]);
}

/** The case opening: the hinge as the leaf turns ('creak'), then the leaf landing on the felt ('land'). */
export function caseSound(part: 'creak' | 'land') {
  if (!on()) return;
  wake();
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  if (part === 'land') {
    knock(t, 620, 0.75);
    knock(t + 0.04, 380, 0.5);
    buzz([30, 40, 14]);
    return;
  }
  // a dry wooden creak: noise through a narrow band that slides up as the leaf turns
  const len = Math.floor(ctx.sampleRate * 0.9);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 90));
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 9;
  band.frequency.setValueAtTime(420, t);
  band.frequency.exponentialRampToValueAtTime(900, t + 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  noise.connect(band).connect(g).connect(ctx.destination);
  noise.start(t);
  knock(t, 900, 0.25);
  buzz(12);
}

/** A piece set down as the board is laid out; the pitch wanders a little, as wood does. */
export function pieceDownSound(n: number, quiet = false) {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.005 : 0;
  // set down on the table beside the box: softer, and no vibration (that is for the board)
  knock(t, (quiet ? 1150 : 1380) + ((n * 37) % 5) * 45, quiet ? 0.16 : 0.3);
  if (!quiet) buzz(8);
}

/** A king going over at mate: the body hitting the board, then its small bounce. */
export function fallSound() {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.005 : 0;
  knock(t, 520, 0.72);
  knock(t + 0.13, 760, 0.28);
  buzz([28, 60, 12]);
}

/** A pawn becoming a piece: two rising notes. */
export function promoteSound() {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.01 : 0;
  tone(t, 784, 0.3, 0.09);
  tone(t + 0.09, 1175, 0.45, 0.09);
  buzz(16);
}

/** The streak grew by a day: a bright double chime. */
export function streakSound() {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.02 : 0;
  tone(t, 988, 0.35, 0.08);
  tone(t + 0.1, 1319, 0.55, 0.08);
  buzz([10, 30, 10]);
}

/** A wrong answer: one low muted note. */
export function missSound() {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.01 : 0;
  tone(t, 220, 0.25, 0.1);
  buzz(40);
}
