import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { allowRate as memoryAllow, resetProxyLimits } from "@inkboard/shared/cdn-proxy";
import { buildApp } from "../../src/app.ts";
import { allowRate, rateConfig } from "../../src/middlewares/rate-limit.ts";

describe("rate limit", () => {
  after(() => {
    delete process.env.RATE_LIMIT;
    delete process.env.RATE_WINDOW_MS;
    resetProxyLimits();
  });

  it("memory limiter trips after N hits from one ip", () => {
    resetProxyLimits();
    const ip = "198.51.100.7";
    for (let i = 0; i < 8; i++) assert.equal(memoryAllow(ip, 8, 60_000), true);
    assert.equal(memoryAllow(ip, 8, 60_000), false);
    resetProxyLimits();
    assert.equal(memoryAllow(ip, 8, 60_000), true);
    resetProxyLimits();
  });

  it("allowRate falls back to memory when redis is down or absent", async () => {
    resetProxyLimits();
    const ip = `test-${Date.now()}`;
    const first = await allowRate(ip, 3, 60_000);
    const second = await allowRate(ip, 3, 60_000);
    const third = await allowRate(ip, 3, 60_000);
    const fourth = await allowRate(ip, 3, 60_000);
    assert.equal(first, true);
    assert.equal(second, true);
    assert.equal(third, true);
    assert.equal(fourth, false);
    resetProxyLimits();
  });

  it("RATE_LIMIT and RATE_WINDOW_MS are the configured cap", () => {
    process.env.RATE_LIMIT = "4";
    process.env.RATE_WINDOW_MS = "5000";
    assert.deepEqual(rateConfig(), { limit: 4, windowMs: 5000 });
    process.env.RATE_LIMIT = "0";
    process.env.RATE_WINDOW_MS = "10";
    assert.deepEqual(rateConfig(), { limit: 120, windowMs: 60_000 });
    delete process.env.RATE_LIMIT;
    delete process.env.RATE_WINDOW_MS;
  });

  it("the api cap returns 429 after the configured number of hits", async () => {
    resetProxyLimits();
    process.env.RATE_LIMIT = "2";
    process.env.RATE_WINDOW_MS = "60000";
    const app = await buildApp();
    try {
      const headers = { "x-forwarded-for": `phase1-${Date.now()}` };
      const first = await app.inject({ method: "GET", url: "/api/exams", headers });
      const second = await app.inject({ method: "GET", url: "/api/exams", headers });
      const third = await app.inject({ method: "GET", url: "/api/exams", headers });
      assert.equal(first.statusCode, 200);
      assert.equal(second.statusCode, 200);
      assert.equal(third.statusCode, 429);
      assert.equal(third.json().code, "RATE_LIMIT");
    } finally {
      delete process.env.RATE_LIMIT;
      delete process.env.RATE_WINDOW_MS;
      await app.close();
      resetProxyLimits();
    }
  });
});
