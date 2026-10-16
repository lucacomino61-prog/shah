// The coach's voice: what the coach says, read aloud in Albanian by the phone's own speech, when the learner asks
// for it (Cilësimet > Trajneri me zë) and the phone has an Albanian voice. Nothing is recorded or sent anywhere; a
// browser without an Albanian voice stays silent and the settings say so.

import { sentenceText } from './notation.ts';

const KEY = 'shah.voice';

let voice: SpeechSynthesisVoice | null = null;
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

function find() {
  if (!synth) return;
  const all = synth.getVoices();
  // an Albanian voice (sq, sq-AL, sq-XK); a natural one first where the browser offers several
  voice = all.filter((v) => /^sq\b|^sq[-_]/i.test(v.lang)).sort((a, b) => Number(/natural|online/i.test(b.name)) - Number(/natural|online/i.test(a.name)))[0] ?? null;
}
if (synth) {
  find();
  synth.addEventListener?.('voiceschanged', find);
}

/** Whether this browser can speak Albanian (the voices may arrive a moment after the page). */
export async function albanianVoice(): Promise<boolean> {
  if (!synth) return false;
  if (voice) return true;
  await new Promise((r) => setTimeout(r, 600));
  find();
  return !!voice;
}

export function voiceOn(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setVoice(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, 'on');
    else localStorage.removeItem(KEY);
  } catch {
    /* it stays off */
  }
  if (!on) synth?.cancel();
}

/** Read the coach's words aloud (moves as words: "kali f3"); a new line cuts off the one still being read. */
export function speakSq(text: string) {
  if (!synth || !voice || !voiceOn()) return;
  const u = new SpeechSynthesisUtterance(sentenceText(text));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 1;
  synth.cancel();
  synth.speak(u);
}
