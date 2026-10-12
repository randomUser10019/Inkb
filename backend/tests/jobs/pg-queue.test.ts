import assert from "node:assert/strict";
import test from "node:test";
import { CLAIM_SQL, mirrorJob } from "../../src/jobs/pg-queue.ts";

test("the claim statement locks one queued row and skips rows another worker holds", () => {
  assert.match(CLAIM_SQL, /for update skip locked/i);
  assert.match(CLAIM_SQL, /state = 'queued'/);
  assert.match(CLAIM_SQL, /limit 1/);
});

test("a job is not written when postgres is not configured", async () => {
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.equal(
      await mirrorJob({ id: "abc", kind: "lecture", state: "queued", payload: { id: "abc" } }),
      false,
    );
  } finally {
    if (prev) process.env.DATABASE_URL = prev;
  }
});
