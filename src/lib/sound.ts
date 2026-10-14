// The sounds of the table, made in the browser (no files to fetch, so they work offline): a wooden click when a
// piece is set down, a heavier knock for a capture, a soft two-note chime for check, a short rising phrase when a
// game or a puzzle is won. A phone that allows it also gives a short vibration (iPhones do not let a page vibrate).
// The Sound switch (Progress.sound) turns all of it off.

import { load } from './store.ts';

let ctx: AudioContext | null = null;

/** Browsers start audio only after a gesture: the first touch or key on the page wakes it. */
function wake() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
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
  addEventListener('keydown', once);
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

const buzz = (pattern: number | number[]) => {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not allowed here */
  }
};

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

/** A wrong answer: one low muted note. */
export function missSound() {
  if (!on()) return;
  wake();
  const t = ctx ? ctx.currentTime + 0.01 : 0;
  tone(t, 220, 0.25, 0.1);
  buzz(40);
}
