import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isHollow, swr, swrInvalidate, swrPeek, swrReset } from "./swr-cache.ts";

afterEach(() => {
  swrReset();
});

describe("swr cache", () => {
  it("dedupes inflight fetches and remembers a fresh hit", async () => {
    let n = 0;
    const fn = async () => {
      n += 1;
      return { n };
    };
    const [a, b] = await Promise.all([swr("k", 5_000, fn), swr("k", 5_000, fn)]);
    assert.equal(a.n, 1);
    assert.equal(b.n, 1);
    assert.equal(n, 1);
    const c = await swr("k", 5_000, fn);
    assert.equal(c.n, 1);
    assert.equal(n, 1);
  });

  it("does not remember empty hubs so the next read refetches", async () => {
    let n = 0;
    const empty = async () => {
      n += 1;
      return { teachers: [], courses: [] };
    };
    await swr("hub", 60_000, empty);
    assert.equal(swrPeek("hub"), undefined);
    await swr("hub", 60_000, empty);
    assert.equal(n, 2);
  });

  it("isHollow detects empty catalog bags and ignores unrelated objects", () => {
    assert.equal(isHollow({ teachers: [], courses: [] }), true);
    assert.equal(isHollow({ teachers: [{ n: 1 }] }), false);
    assert.equal(isHollow({ n: 1 }), false);
    assert.equal(isHollow([]), true);
    assert.equal(isHollow(null), true);
  });

  it("invalidate drops a key so the next read is not stale", async () => {
    let n = 0;
    const fn = async () => {
      n += 1;
      return { n };
    };
    await swr("exam-hub12:NVLIA", 60_000, fn);
    assert.equal(swrPeek<{ n: number }>("exam-hub12:NVLIA")?.n, 1);
    swrInvalidate("exam-hub12:");
    assert.equal(swrPeek("exam-hub12:NVLIA"), undefined);
    const next = await swr("exam-hub12:NVLIA", 60_000, fn);
    assert.equal(next.n, 2);
    assert.equal(n, 2);
  });

  it("an in-flight fetch started before invalidate does not restore the old value", async () => {
    let resolveFirst!: (v: { n: number }) => void;
    const first = new Promise<{ n: number }>((resolve) => {
      resolveFirst = resolve;
    });
    let n = 0;
    const p1 = swr("course8:ABC", 60_000, async () => {
      n += 1;
      return first;
    });
    swrInvalidate("course8:");
    resolveFirst({ n: 1 });
    assert.deepEqual(await p1, { n: 1 });
    assert.equal(swrPeek("course8:ABC"), undefined);
    const p2 = await swr("course8:ABC", 60_000, async () => {
      n += 1;
      return { n };
    });
    assert.equal(p2.n, 2);
    assert.equal(n, 2);
  });
});
