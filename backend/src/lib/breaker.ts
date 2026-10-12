import { unavailable } from "@inkboard/shared/http-error";

/**
 * Stops calling a dead upstream after repeated failures.
 * The next call after the cool-down is allowed through. A success closes it.
 */
export function createBreaker(opts?: { failures?: number; resetMs?: number; now?: () => number }) {
  const limit = opts?.failures ?? 5;
  const resetMs = opts?.resetMs ?? 30_000;
  const now = opts?.now ?? (() => Date.now());
  let fails = 0;
  let openUntil = 0;

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (now() < openUntil) throw unavailable("Catalog is unavailable. Try again shortly.");
      try {
        const value = await fn();
        fails = 0;
        openUntil = 0;
        return value;
      } catch (err) {
        fails += 1;
        if (fails >= limit) openUntil = now() + resetMs;
        throw err;
      }
    },
    open(): boolean {
      return now() < openUntil;
    },
  };
}

export const catalogBreaker = createBreaker();

export function runGuarded<T>(fn: () => Promise<T>): Promise<T> {
  return catalogBreaker.run(fn);
}
