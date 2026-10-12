import { fetchAllowlisted, type AllowFn } from "./cdn-proxy.ts";

const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function shouldRetryStatus(status: number) {
  return RETRY_STATUSES.has(status);
}

export function backoffMs(attempt: number, baseMs = 280, rand: () => number = Math.random) {
  const exp = baseMs * 2 ** attempt;
  return Math.min(4_000, Math.round(exp + rand() * exp * 0.35));
}

export function isRetryableError(err: unknown) {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (err.name === "TimeoutError" || err.name === "AbortError") return true;
  return msg.includes("network") || msg.includes("fetch") || msg.includes("econnreset") || msg.includes("socket");
}

type RetryInit = RequestInit & {
  timeoutMs?: number;
  retries?: number;
  baseMs?: number;
  /** Hard cap for the whole retry loop, including backoff. Default 18s. */
  budgetMs?: number;
  /** When set, hops are checked against this allowlist (redirect: "manual"). */
  allowed?: AllowFn;
};

function wrapBodyKeepAlive(res: Response, onDone: () => void): Response {
  const body = res.body;
  if (!body) {
    onDone();
    return res;
  }
  const reader = body.getReader();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onDone();
  };
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish();
          controller.close();
          return;
        }
        if (value) controller.enqueue(value);
      } catch (err) {
        finish();
        controller.error(err);
      }
    },
    cancel(reason) {
      finish();
      return reader.cancel(reason);
    },
  });
  return new Response(stream, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export async function fetchWithRetry(url: string, init: RetryInit = {}) {
  const { timeoutMs = 12_000, retries = 2, baseMs = 280, budgetMs = 18_000, signal, allowed, ...rest } = init;
  const started = Date.now();
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const remaining = budgetMs - (Date.now() - started);
    if (remaining <= 0) {
      const err = new Error("Request timed out");
      err.name = "TimeoutError";
      throw err;
    }
    const attemptMs = Math.min(timeoutMs, remaining);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), attemptMs);
    const onAbort = () => ctrl.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    let keepTimer = false;
    try {
      const res = allowed
        ? await fetchAllowlisted(url, { ...rest, allowed, signal: ctrl.signal })
        : await fetch(url, {
            ...rest,
            redirect: rest.redirect ?? "follow",
            signal: ctrl.signal,
          });
      if (res.ok || !shouldRetryStatus(res.status) || attempt === retries) {
        keepTimer = true;
        return wrapBodyKeepAlive(res, () => {
          clearTimeout(timer);
          signal?.removeEventListener("abort", onAbort);
        });
      }
      last = new Error(`HTTP ${res.status}`);
    } catch (err) {
      last = err;
      if (signal?.aborted || attempt === retries || !isRetryableError(err)) throw err;
    } finally {
      if (!keepTimer) {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    }
    const wait = backoffMs(attempt, baseMs);
    if (Date.now() - started + wait >= budgetMs) {
      throw last instanceof Error ? last : new Error("Request timed out");
    }
    await new Promise((r) => setTimeout(r, wait));
  }
  throw last instanceof Error ? last : new Error("Request failed");
}
