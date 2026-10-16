// One challenge between friends ("Sfida"): ten puzzles fixed by whoever made it, the same for everyone who opens the
// link, and a board of how each did (puzzles solved without help, then the time). Names are what people type, at
// most 20 letters; a player is one entry (kept by a token the phone keeps), at most 50 of them. It is gone after two
// weeks.

import { DurableObject } from 'cloudflare:workers';

const TWO_WEEKS = 14 * 24 * 3600 * 1000;
const MAX_ENTRIES = 50;
export const PUZZLE_RE = /^[A-Za-z0-9]{4,8}$/;

export interface Entry {
  name: string;
  score: number;
  ms: number;
  at: number;
}

interface Stored {
  code: string;
  puzzles: string[];
  by: string;
  at: number;
  entries: Record<string, Entry>;
}

export interface ContestInfo {
  code: string;
  puzzles: string[];
  by: string;
  at: number;
  ends: number;
  board: Entry[];
}

/** A name as people type it: trimmed, no control characters, at most 20 letters. */
export function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  return s.length >= 1 && [...s].length <= 20 ? s : null;
}

const ranked = (e: Record<string, Entry>) => Object.values(e).sort((a, b) => b.score - a.score || a.ms - b.ms || a.at - b.at);

export class Contest extends DurableObject<Env> {
  private async load() {
    return (await this.ctx.storage.get<Stored>('c')) ?? null;
  }

  private view(c: Stored): ContestInfo {
    return { code: c.code, puzzles: c.puzzles, by: c.by, at: c.at, ends: c.at + TWO_WEEKS, board: ranked(c.entries) };
  }

  async create(code: string, puzzles: unknown, by: unknown): Promise<ContestInfo | { error: string }> {
    if (await this.load()) return { error: 'taken' };
    const name = cleanName(by);
    if (!name) return { error: 'name' };
    if (!Array.isArray(puzzles) || puzzles.length < 3 || puzzles.length > 12 || !puzzles.every((p) => typeof p === 'string' && PUZZLE_RE.test(p))) return { error: 'puzzles' };
    const at = Date.now();
    const c: Stored = { code, puzzles: puzzles as string[], by: name, at, entries: {} };
    await this.ctx.storage.put('c', c);
    await this.ctx.storage.setAlarm(at + TWO_WEEKS);
    return this.view(c);
  }

  async info(): Promise<ContestInfo | null> {
    const c = await this.load();
    return c ? this.view(c) : null;
  }

  /** A result: one entry per player token; a second try counts only if it is better. */
  async submit(token: unknown, name: unknown, score: unknown, ms: unknown): Promise<ContestInfo | { error: string }> {
    const c = await this.load();
    if (!c) return { error: 'missing' };
    const who = cleanName(name);
    if (typeof token !== 'string' || !/^[0-9a-f]{32}$/.test(token)) return { error: 'token' };
    if (!who) return { error: 'name' };
    if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > c.puzzles.length) return { error: 'score' };
    if (!Number.isInteger(ms) || (ms as number) < 1000 || (ms as number) > 3 * 3600 * 1000) return { error: 'time' };
    const before = c.entries[token];
    if (!before && Object.keys(c.entries).length >= MAX_ENTRIES) return { error: 'full' };
    const next: Entry = { name: who, score: score as number, ms: ms as number, at: Date.now() };
    const better = !before || next.score > before.score || (next.score === before.score && next.ms < before.ms);
    if (better) c.entries[token] = next;
    else c.entries[token] = { ...before, name: who };
    await this.ctx.storage.put('c', c);
    return this.view(c);
  }

  async alarm() {
    await this.ctx.storage.deleteAll();
  }
}
