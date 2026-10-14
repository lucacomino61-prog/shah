// One learner's progress, encrypted on the phone before it leaves (the server never sees the sync code, only a hash
// of it, and never the key). A write names the revision it was based on, so two phones writing at once cannot
// overwrite each other: the late one is told to merge first. A vault nobody touches for a year is emptied.

import { DurableObject } from 'cloudflare:workers';

const YEAR = 365 * 24 * 3600 * 1000;
const MAX = 1_500_000;

interface Stored {
  rev: number;
  blob: string;
  at: number;
}

export class Vault extends DurableObject<Env> {
  async read(): Promise<Stored | null> {
    return (await this.ctx.storage.get<Stored>('v')) ?? null;
  }

  async write(base: number, blob: string): Promise<{ ok: true; rev: number } | { ok: false; error: 'stale'; rev: number; blob: string | null } | { ok: false; error: 'big' }> {
    if (blob.length > MAX) return { ok: false, error: 'big' };
    const cur = await this.read();
    const rev = cur?.rev ?? 0;
    if (base !== rev) return { ok: false, error: 'stale', rev, blob: cur?.blob ?? null };
    const at = Date.now();
    await this.ctx.storage.put('v', { rev: rev + 1, blob, at });
    await this.ctx.storage.setAlarm(at + YEAR);
    return { ok: true, rev: rev + 1 };
  }

  async wipe() {
    await this.ctx.storage.deleteAll();
  }

  async alarm() {
    const cur = await this.read();
    if (cur && Date.now() - cur.at < YEAR) await this.ctx.storage.setAlarm(cur.at + YEAR);
    else await this.ctx.storage.deleteAll();
  }
}
