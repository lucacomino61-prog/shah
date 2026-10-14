// The daily reminder. Each phone that asks for it leaves its push subscription, the hour it chose and its time
// zone; once an hour the cron asks the bell to ring, and every phone whose hour it is gets one notification, but
// only if today's puzzle is not solved yet (the app says when it is) and only once a day.

import { DurableObject } from 'cloudflare:workers';
import { sendPush, type Subscription } from './push';

interface Sub extends Subscription {
  hour: number;
  tz: string;
  /** the learner's local date of the last solved daily puzzle, and the streak then */
  done: string;
  streak: number;
  /** the local date a reminder last went out */
  sent: string;
  made: number;
}

const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.notify\.windows\.com$/];
const B64U = /^[A-Za-z0-9_-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function keyOf(endpoint: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return 'sub:' + [...h.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** the date and hour on the learner's own clock */
export function localTime(tz: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

const days = (n: number) => (n === 1 ? 'një dite' : `${n} ditësh`);

export class Bell extends DurableObject<Env> {
  private endpointOk(endpoint: unknown): endpoint is string {
    if (typeof endpoint !== 'string' || endpoint.length > 1000) return false;
    let u: URL;
    try {
      u = new URL(endpoint);
    } catch {
      return false;
    }
    if (this.env.PUSH_LOCAL === '1' && u.protocol === 'http:' && u.hostname === '127.0.0.1') return true;
    return u.protocol === 'https:' && PUSH_HOSTS.some((re) => re.test(u.hostname));
  }

  async subscribe(b: Record<string, unknown>) {
    const sub = b.sub as Partial<Subscription> | undefined;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;
    if (!this.endpointOk(sub?.endpoint) || typeof p256dh !== 'string' || typeof auth !== 'string' || !B64U.test(p256dh) || !B64U.test(auth) || p256dh.length !== 87 || auth.length !== 22)
      return { ok: false, error: 'subscription' };
    const hour = Number(b.hour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: 'hour' };
    let tz = typeof b.tz === 'string' ? b.tz : 'UTC';
    try {
      localTime(tz, new Date());
    } catch {
      tz = 'UTC';
    }
    const key = await keyOf(sub!.endpoint!);
    const old = await this.ctx.storage.get<Sub>(key);
    await this.ctx.storage.put(key, {
      endpoint: sub!.endpoint!,
      keys: { p256dh, auth },
      hour,
      tz,
      done: typeof b.done === 'string' && DATE.test(b.done) ? b.done : (old?.done ?? ''),
      streak: Number.isInteger(b.streak) ? Math.max(0, Number(b.streak)) : (old?.streak ?? 0),
      sent: old?.sent ?? '',
      made: old?.made ?? Date.now(),
    } satisfies Sub);
    return { ok: true };
  }

  async unsubscribe(b: Record<string, unknown>) {
    if (typeof b.endpoint !== 'string') return { ok: false, error: 'subscription' };
    await this.ctx.storage.delete(await keyOf(b.endpoint));
    return { ok: true };
  }

  async done(b: Record<string, unknown>) {
    if (typeof b.endpoint !== 'string' || typeof b.date !== 'string' || !DATE.test(b.date)) return { ok: false, error: 'bad' };
    const key = await keyOf(b.endpoint);
    const s = await this.ctx.storage.get<Sub>(key);
    if (!s) return { ok: false, error: 'missing' };
    s.done = b.date;
    if (Number.isInteger(b.streak)) s.streak = Math.max(0, Number(b.streak));
    await this.ctx.storage.put(key, s);
    return { ok: true };
  }

  /** the hourly ring: who is due, who already played today, who is gone */
  async tick() {
    const now = new Date();
    const subs = await this.ctx.storage.list<Sub>({ prefix: 'sub:' });
    let sent = 0;
    let removed = 0;
    for (const [key, s] of subs) {
      const t = localTime(s.tz, now);
      if (t.hour !== s.hour || s.done === t.date || s.sent === t.date) continue;
      const alive = s.streak > 0 && s.done === localTime(s.tz, new Date(now.getTime() - 86400000)).date;
      const body = alive ? `Ushtrimi i ditës të pret. Mos e humb serinë prej ${days(s.streak)}.` : 'Ushtrimi i ditës të pret.';
      let status = 0;
      try {
        status = await sendPush(s, { title: 'Shah', body, url: '/ushtrime/?tema=dita', tag: 'daily' }, this.env);
      } catch (e) {
        console.error('push failed', e);
      }
      if (status === 404 || status === 410) {
        await this.ctx.storage.delete(key);
        removed++;
      } else if (status >= 200 && status < 300) {
        s.sent = t.date;
        await this.ctx.storage.put(key, s);
        sent++;
      }
    }
    return { checked: subs.size, sent, removed };
  }
}
