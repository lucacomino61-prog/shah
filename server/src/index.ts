// The front door: CORS for the app's own origins, then each request handed to the Durable Object that owns it
// (one Room per game code, one Vault per sync code, one Bell for every reminder, one Contest per challenge).

import { Bell } from './bell';
import { Contest } from './contest';
import { Room, CODE_RE, newCode } from './room';
import { Vault } from './vault';

export { Bell, Contest, Room, Vault };

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

function originAllowed(origin: string | null, env: Env): boolean {
  if (!origin) return false;
  if (env.ORIGINS.split(',').includes(origin)) return true;
  // Pages preview deploys: https://<hash>.shah-trajneri.pages.dev
  return /^https:\/\/[a-z0-9-]+\.shah-trajneri\.pages\.dev$/.test(origin);
}

function withCors(res: Response, origin: string | null): Response {
  if (!origin) return res;
  const out = new Response(res.body, res);
  out.headers.set('Access-Control-Allow-Origin', origin);
  out.headers.set('Vary', 'Origin');
  return out;
}

async function body<T>(req: Request, max = 4096): Promise<T | null> {
  const text = await req.text();
  if (text.length > max) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function route(req: Request, url: URL, env: Env): Promise<Response> {
  const parts = url.pathname.split('/').filter(Boolean);

  if (parts[0] === 'room') {
    if (parts.length === 1 && req.method === 'POST') {
      const opts = await body<{ side?: string; clock?: string }>(req);
      if (!opts) return json({ error: 'bad' }, 400);
      // a fresh code: one already in use is drawn again
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const out = await env.ROOMS.get(env.ROOMS.idFromName(code)).create(code, opts.side ?? 'random', opts.clock ?? 'none');
        if ('error' in out && out.error === 'taken') continue;
        return json(out, 'error' in out ? 400 : 200);
      }
      return json({ error: 'busy' }, 503);
    }
    const code = (parts[1] ?? '').toUpperCase();
    if (!CODE_RE.test(code)) return json({ error: 'missing' }, 404);
    const room = env.ROOMS.get(env.ROOMS.idFromName(code));
    if (parts.length === 2 && req.method === 'GET') {
      const info = await room.info();
      return json(info, info ? 200 : 404);
    }
    if (parts[2] === 'join' && req.method === 'POST') {
      const b = await body<{ token?: string }>(req);
      const out = await room.join(typeof b?.token === 'string' ? b.token : null);
      return json(out, 'error' in out ? (out.error === 'missing' ? 404 : 409) : 200);
    }
    if (parts[2] === 'ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket' }, 426);
      return room.fetch(req);
    }
    return json({ error: 'missing' }, 404);
  }

  // a challenge between friends: ten puzzles and a board of results
  if (parts[0] === 'contest') {
    if (parts.length === 1 && req.method === 'POST') {
      const b = await body<{ puzzles?: unknown; name?: unknown }>(req);
      if (!b) return json({ error: 'bad' }, 400);
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const out = await env.CONTESTS.get(env.CONTESTS.idFromName(code)).create(code, b.puzzles, b.name);
        if ('error' in out && out.error === 'taken') continue;
        return json(out, 'error' in out ? 400 : 200);
      }
      return json({ error: 'busy' }, 503);
    }
    const code = (parts[1] ?? '').toUpperCase();
    if (!CODE_RE.test(code)) return json({ error: 'missing' }, 404);
    const contest = env.CONTESTS.get(env.CONTESTS.idFromName(code));
    if (parts.length === 2 && req.method === 'GET') {
      const info = await contest.info();
      return json(info ?? { error: 'missing' }, info ? 200 : 404);
    }
    if (parts[2] === 'score' && req.method === 'POST') {
      const b = await body<{ token?: unknown; name?: unknown; score?: unknown; ms?: unknown }>(req);
      if (!b) return json({ error: 'bad' }, 400);
      const out = await contest.submit(b.token, b.name, b.score, b.ms);
      return json(out, 'error' in out ? (out.error === 'missing' ? 404 : out.error === 'full' ? 409 : 400) : 200);
    }
    return json({ error: 'missing' }, 404);
  }

  if (parts[0] === 'sync' && /^[0-9a-f]{40}$/.test(parts[1] ?? '')) {
    const vault = env.VAULTS.get(env.VAULTS.idFromName(parts[1]));
    if (req.method === 'GET') {
      const v = await vault.read();
      return v ? json(v) : json({ error: 'missing' }, 404);
    }
    if (req.method === 'PUT') {
      const b = await body<{ base?: number; blob?: string }>(req, 2_000_000);
      if (!b || typeof b.base !== 'number' || typeof b.blob !== 'string') return json({ error: 'bad' }, 400);
      const out = await vault.write(b.base, b.blob);
      return json(out, out.ok ? 200 : out.error === 'stale' ? 409 : 413);
    }
    if (req.method === 'DELETE') {
      await vault.wipe();
      return json({ ok: true });
    }
  }

  if (parts[0] === 'push') {
    const bell = env.BELL.get(env.BELL.idFromName('bell'));
    if (parts[1] === 'key' && req.method === 'GET') return json({ key: env.VAPID_PUBLIC });
    if (req.method === 'POST') {
      const b = await body<Record<string, unknown>>(req);
      if (!b) return json({ error: 'bad' }, 400);
      const out =
        parts[1] === 'subscribe' ? await bell.subscribe(b) : parts[1] === 'unsubscribe' ? await bell.unsubscribe(b) : parts[1] === 'done' ? await bell.done(b) : null;
      if (!out) return json({ error: 'missing' }, 404);
      return json(out, out.ok ? 200 : 400);
    }
  }

  if (url.pathname === '/') return json({ app: 'shah', ok: true });
  return json({ error: 'missing' }, 404);
}

export default {
  async fetch(req, env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    const allowed = originAllowed(origin, env);
    if (req.method === 'OPTIONS') {
      if (!allowed) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin!,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        },
      });
    }
    // only the app's own pages may talk to it (a browser always sends Origin on these requests)
    if (origin && !allowed) return json({ error: 'origin' }, 403);
    let res: Response;
    try {
      res = await route(req, url, env);
    } catch (e) {
      console.error(e);
      res = json({ error: 'server' }, 500);
    }
    if (res.webSocket) return res;
    return withCors(res, allowed ? origin : null);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(env.BELL.get(env.BELL.idFromName('bell')).tick());
  },
} satisfies ExportedHandler<Env>;
