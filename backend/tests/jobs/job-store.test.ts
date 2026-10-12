import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { jobView, loadStoredJobs, rememberJob } from "../../src/routes/jobs.ts";

describe("job store", () => {
  it("reloads a finished job and marks an interrupted one as failed", () => {
    const root = mkdtempSync(join(tmpdir(), "ink-jobs-"));
    const doneDir = join(root, "done-job");
    const runDir = join(root, "run-job");
    mkdirSync(doneDir, { recursive: true });
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(doneDir, "sprites.json"), "{}");
    writeFileSync(
      join(doneDir, "job.json"),
      JSON.stringify({
        id: "done-job",
        kind: "lecture",
        state: "done",
        pct: 100,
        step: "done",
        outDir: doneDir,
        mediaDir: doneDir,
        payload: { id: "abc12345" },
      }),
    );
    writeFileSync(
      join(runDir, "job.json"),
      JSON.stringify({
        id: "run-job",
        kind: "lecture",
        state: "running",
        pct: 10,
        step: "enhancing",
        outDir: runDir,
        payload: {},
      }),
    );
    const loaded = loadStoredJobs(root);
    assert.equal(loaded, 2);
    assert.equal(jobView("done-job")?.state, "done");
    assert.equal(jobView("done-job")?.mediaDir, doneDir);
    assert.equal(jobView("run-job")?.state, "error");
    assert.match(jobView("run-job")?.error || "", /Interrupted/);
    rememberJob({
      id: "memory-only",
      kind: "lecture",
      state: "done",
      pct: 100,
      step: "done",
      outDir: doneDir,
      payload: {},
      abort: new AbortController(),
    });
    assert.equal(jobView("memory-only")?.state, "done");
  });
});
