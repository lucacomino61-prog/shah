// Sync between the learner's phones. A sync code (16 letters, shown once and typed or shared to the other phone)
// is the only secret: the server stores the progress encrypted with a key made from it and finds it by a hash of
// it, so it can neither read the progress nor find whose it is. Each phone pulls on opening, merges (merge.ts),
// and sends its own changes a few seconds after they happen. The game in progress stays on its own phone.

import { canon, merge } from './merge.ts';
import { api, hasServer, ServerError } from './server.ts';
import { fresh, load, save, type Progress } from './store.ts';

const KEY = 'shah.sync';
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const CODE_RE = /^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{16}$/;

export interface SyncState {
  code: string;
  /** the server's revision this phone last saw */
  rev: number;
  /** a hash of the progress as last exchanged: a different one means something changed here since */
  hash: string;
  /** ISO time of the last good sync */
  at: string;
}

export function syncState(): SyncState | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as SyncState | null;
    return s && CODE_RE.test(s.code) ? s : null;
  } catch {
    return null;
  }
}
function writeState(s: SyncState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: sync lasts for this page */
  }
}

export function newCode(): string {
  let out = '';
  while (out.length < 16) for (const b of crypto.getRandomValues(new Uint8Array(32))) if (b < 240 && out.length < 16) out += ALPHABET[b % 30];
  return out;
}
/** what the learner typed, as a code: case, spaces and dashes do not matter */
export const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const pretty = (c: string) => c.match(/.{1,4}/g)!.join('-');

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
const idOf = async (code: string) => (await sha('shah-sync-id:' + code)).slice(0, 40);
const hashOf = (p: Progress) => sha(canon(p));

const keys = new Map<string, Promise<CryptoKey>>();
function keyOf(code: string): Promise<CryptoKey> {
  if (!keys.has(code))
    keys.set(
      code,
      crypto.subtle
        .importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveKey'])
        .then((base) => crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('shah-sync-v1'), iterations: 150_000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])),
    );
  return keys.get(code)!;
}

const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};
const toB64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const through = async (b: Uint8Array, stream: GenericTransformStream) => new Uint8Array(await new Response(new Blob([b as BlobPart]).stream().pipeThrough(stream)).arrayBuffer());

/** progress -> gzip (where the browser can) -> AES-GCM -> base64; the first byte says whether it was zipped */
async function seal(code: string, p: Progress): Promise<string> {
  const json = enc.encode(canon(p));
  const packed = typeof CompressionStream === 'function' ? join(new Uint8Array([1]), await through(json, new CompressionStream('gzip'))) : join(new Uint8Array([0]), json);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return toB64(join(iv, new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(code), packed))));
}
async function unseal(code: string, blob: string): Promise<Progress> {
  const all = fromB64(blob);
  const packed = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, await keyOf(code), all.subarray(12)));
  const json = packed[0] === 1 ? await through(packed.subarray(1), new DecompressionStream('gzip')) : packed.subarray(1);
  return { ...fresh(), ...JSON.parse(new TextDecoder().decode(json)) };
}

export type SyncResult = { ok: true; changed: boolean } | { ok: false; reason: 'off' | 'offline' | 'server' | 'missing' | 'key' };
const failure = (e: unknown): SyncResult => ({ ok: false, reason: e instanceof ServerError && e.status === 0 ? 'offline' : 'server' });

async function run(): Promise<SyncResult> {
  const st = syncState();
  if (!st || !hasServer) return { ok: false, reason: 'off' };
  const id = await idOf(st.code);
  let changed = false;
  const done = async (p: Progress, rev: number): Promise<SyncResult> => {
    // stopped meanwhile: leave it stopped
    if (syncState()?.code !== st.code) return { ok: false, reason: 'off' };
    writeState({ code: st.code, rev, hash: await hashOf(p), at: new Date().toISOString() });
    return { ok: true, changed };
  };
  for (let tries = 0; tries < 3; tries++) {
    let remote: { rev: number; blob: string } | null = null;
    try {
      remote = await api<{ rev: number; blob: string }>(`/sync/${id}`);
    } catch (e) {
      if (!(e instanceof ServerError && e.status === 404)) return failure(e);
      // the copy this phone synced with was wiped (from another phone, or a year unused): sync stops here too
      if (st.rev > 0) {
        writeState(null);
        window.dispatchEvent(new Event('shah:sync-wiped'));
        return { ok: false, reason: 'missing' };
      }
    }
    let next = load();
    if (remote && remote.rev !== st.rev) {
      let theirs: Progress;
      try {
        theirs = await unseal(st.code, remote.blob);
      } catch {
        return { ok: false, reason: 'key' };
      }
      const mine = load();
      next = merge(mine, theirs);
      if (canon(next) !== canon(mine)) {
        save(next, false);
        changed = true;
      }
      if (canon(next) === canon(theirs)) return done(next, remote.rev);
    } else if (remote && (await hashOf(next)) === st.hash) {
      return done(next, remote.rev);
    }
    // this phone has something the server lacks
    try {
      const out = await api<{ rev: number }>(`/sync/${id}`, { method: 'PUT', body: { base: remote?.rev ?? 0, blob: await seal(st.code, next) } });
      return done(next, out.rev);
    } catch (e) {
      // another phone wrote first: merge with its copy and try again
      if (e instanceof ServerError && e.status === 409) {
        st.rev = -1;
        continue;
      }
      return failure(e);
    }
  }
  return { ok: false, reason: 'server' };
}

let running: Promise<SyncResult> | null = null;
/** One exchange with the server (one at a time); `shah:synced` tells the page when another phone's progress came in. */
export function syncNow(): Promise<SyncResult> {
  if (!running)
    running = run()
      .then((r) => {
        if (r.ok && r.changed) window.dispatchEvent(new Event('shah:synced'));
        return r;
      })
      .finally(() => (running = null));
  return running;
}

/** Sync turned on here: a new code, and this phone's progress as the first copy. */
export async function startSync(): Promise<{ code: string; result: SyncResult }> {
  const code = newCode();
  writeState({ code, rev: 0, hash: '', at: '' });
  const result = await syncNow();
  if (!result.ok) writeState(null);
  return { code, result };
}

/** A code from another phone: its copy is merged with this one. */
export async function joinSync(typed: string): Promise<SyncResult> {
  const code = normalize(typed);
  if (!CODE_RE.test(code)) return { ok: false, reason: 'missing' };
  try {
    await api(`/sync/${await idOf(code)}`);
  } catch (e) {
    return e instanceof ServerError && e.status === 404 ? { ok: false, reason: 'missing' } : failure(e);
  }
  writeState({ code, rev: -1, hash: '', at: '' });
  const result = await syncNow();
  if (!result.ok) writeState(null);
  return result;
}

/** Sync off on this phone; `wipe` also deletes the copy on the server (the other phones then stop too). */
export async function stopSync(wipe: boolean): Promise<boolean> {
  const st = syncState();
  if (!st) return true;
  if (wipe) {
    try {
      await api(`/sync/${await idOf(st.code)}`, { method: 'DELETE' });
    } catch {
      return false;
    }
  }
  writeState(null);
  return true;
}

/** Every page: pull on opening and on coming back to the app, send a few seconds after a change. */
export function autoSync() {
  if (!hasServer) return;
  const go = () => {
    if (syncState() && navigator.onLine !== false) void syncNow();
  };
  setTimeout(go, 600);
  let t: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('shah:saved', () => {
    clearTimeout(t);
    t = setTimeout(go, 3000);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') go();
  });
  window.addEventListener('online', go);
}
