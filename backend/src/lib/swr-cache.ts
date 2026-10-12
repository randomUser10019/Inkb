import { cacheGet, cacheSet } from "../repositories/postgres/cache.ts";
import { postgresConfigured } from "../repositories/postgres/client.ts";

type Entry = { at: number; data: unknown };

const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const MAX = 400;
let generation = 0;

function remember(key: string, data: unknown, staleMs?: number) {
  mem.set(key, { at: Date.now(), data });
  while (mem.size > MAX) {
    const first = mem.keys().next().value;
    if (first == null) break;
    mem.delete(first);
  }
  if (staleMs) void cacheSet(key, data, staleMs);
}

export function isHollow(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data !== "object") return false;
  const rec = data as Record<string, unknown>;
  const bags = ["teachers", "courses", "playlists", "lessons", "live", "later", "trending", "hits"];
  const present = bags.filter((k) => Array.isArray(rec[k]));
  if (!present.length) return false;
  return present.every((k) => (rec[k] as unknown[]).length === 0);
}

export function swrPeek<T>(key: string): T | undefined {
  const hit = mem.get(key);
  return hit ? (hit.data as T) : undefined;
}

export function swrInvalidate(prefix = "") {
  generation += 1;
  for (const key of [...mem.keys()]) {
    if (!prefix || key.startsWith(prefix)) mem.delete(key);
  }
  for (const key of [...inflight.keys()]) {
    if (!prefix || key.startsWith(prefix)) inflight.delete(key);
  }
}

export function swrReset() {
  mem.clear();
  inflight.clear();
  generation = 0;
}

export function swr<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  staleMs = ttlMs * 6,
  keep: (data: T) => boolean = (data) => !isHollow(data),
): Promise<T> {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && now - hit.at < ttlMs) {
    mem.delete(key);
    mem.set(key, hit);
    return Promise.resolve(hit.data as T);
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  const run = (): Promise<T> => {
    if (pending) return pending;
    const started = generation;
    const p = fn()
      .then((data) => {
        if (started === generation && keep(data)) remember(key, data, staleMs);
        return data;
      })
      .finally(() => {
        if (inflight.get(key) === p) inflight.delete(key);
      });
    inflight.set(key, p);
    return p;
  };

  if (hit && now - hit.at < staleMs) {
    void run();
    return Promise.resolve(hit.data as T);
  }

  if (!hit && postgresConfigured()) {
    return cacheGet<T>(key).then((cached) => {
      if (cached != null && keep(cached)) {
        remember(key, cached);
        void run();
        return cached;
      }
      return run();
    });
  }

  return run();
}
