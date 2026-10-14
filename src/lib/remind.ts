// The daily reminder, on the phone's side: permission, a push subscription for the service worker, and the hour
// and time zone sent to the server. The server rings only on days the daily puzzle is still open, so the app tells
// it whenever the puzzle is solved.

import { api, hasServer } from './server.ts';
import { load, today } from './store.ts';

const KEY = 'shah.remind';

/** 'yes'; 'install' on an iPhone or iPad where Shah is not yet on the home screen (iOS allows push only there); 'no' */
export function remindSupport(): 'yes' | 'install' | 'no' {
  if (!hasServer) return 'no';
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'yes';
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  return ios ? 'install' : 'no';
}

export function remindHour(): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as { hour: number } | null;
    return v && Number.isInteger(v.hour) ? v.hour : null;
  } catch {
    return null;
  }
}
function writeHour(hour: number | null) {
  try {
    if (hour === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ hour }));
  } catch {
    /* blocked storage */
  }
}

const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

async function subscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('no service worker');
  const had = await reg.pushManager.getSubscription();
  if (had || !create) return had;
  const { key } = await api<{ key: string }>('/push/key');
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromB64u(key) });
}

/** Turns the reminder on (or moves it to another hour). */
export async function remindAt(hour: number): Promise<'ok' | 'denied' | 'error'> {
  try {
    if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return 'denied';
    const sub = await subscription(true);
    const p = load();
    await api('/push/subscribe', {
      body: { sub: sub!.toJSON(), hour, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, done: p.streak.last, streak: p.streak.count },
    });
    writeHour(hour);
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function remindOff(): Promise<void> {
  writeHour(null);
  try {
    const sub = await subscription(false);
    if (!sub) return;
    await api('/push/unsubscribe', { body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  } catch {
    /* nothing to undo */
  }
}

/** Today's puzzle is solved: no reminder today. */
export async function remindDone() {
  if (remindHour() === null || remindSupport() !== 'yes') return;
  try {
    const sub = await subscription(false);
    const p = load();
    if (sub) await api('/push/done', { body: { endpoint: sub.endpoint, date: today(), streak: p.streak.count }, keepalive: true });
  } catch {
    /* the reminder may ring once for nothing */
  }
}
