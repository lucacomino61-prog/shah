// Where Shah's small server lives (server/, a Cloudflare Worker): online games with a friend, sync between phones,
// the daily reminder. PUBLIC_SHAH_SERVER is set when the app is built for the live site; in development the server
// runs beside the app on port 8787. Without one, the pages hide what needs it.

export const SERVER: string = String(import.meta.env.PUBLIC_SHAH_SERVER || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : '')).replace(/\/$/, '');
export const hasServer = SERVER !== '';
export const wsBase = SERVER.replace(/^http/, 'ws');

export class ServerError extends Error {
  constructor(
    public status: number,
    public data: Record<string, unknown> | null,
  ) {
    super(`server ${status}`);
  }
}

/** A JSON request to the server; an answer outside 2xx throws ServerError (status 0: no connection). */
export async function api<T>(path: string, init: { method?: string; body?: unknown; keepalive?: boolean } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(SERVER + path, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      keepalive: init.keepalive,
      cache: 'no-store',
    });
  } catch {
    throw new ServerError(0, null);
  }
  let data: Record<string, unknown> | null = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  if (!res.ok) throw new ServerError(res.status, data);
  return data as T;
}
