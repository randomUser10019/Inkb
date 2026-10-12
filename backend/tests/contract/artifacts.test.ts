import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { testApp } from "../helpers/app.ts";
import { rememberJob } from "../../src/routes/jobs.ts";

describe("job artifact contract", () => {
  let app: FastifyInstance;
  before(async () => {
    app = await testApp();
  });
  after(async () => {
    await app.close();
  });

  it("serves an allowlisted sprite manifest and rejects traversal", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ink-job-"));
    writeFileSync(join(dir, "sprites.json"), JSON.stringify({ interval: 10, columns: 1, rows: 1, url: "sprites.webp" }));
    rememberJob({
      id: "job-art",
      kind: "lecture",
      state: "done",
      pct: 100,
      step: "done",
      outDir: dir,
      mediaDir: dir,
      payload: {},
      abort: new AbortController(),
    });
    const ok = await app.inject({ method: "GET", url: "/api/jobs/job-art/artifacts/sprites.json" });
    assert.equal(ok.statusCode, 200);
    assert.match(String(ok.headers["content-type"] || ""), /json/);
    assert.equal(ok.json().interval, 10);
    const bad = await app.inject({ method: "GET", url: "/api/jobs/job-art/artifacts/notes.pdf" });
    assert.equal(bad.statusCode, 400);
    const slip = await app.inject({ method: "GET", url: "/api/jobs/job-art/artifacts/..%2F..%2Fetc%2Fpasswd" });
    assert.equal(slip.statusCode, 400);
    const missing = await app.inject({ method: "GET", url: "/api/jobs/missing/artifacts/sprites.json" });
    assert.equal(missing.statusCode, 404);
  });
});
