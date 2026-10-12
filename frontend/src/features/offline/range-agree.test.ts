import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rangeReply } from "../../../public/offline-range.js";
import { sliceRange } from "./range.ts";

const bytes = new Uint8Array([10, 20, 30, 40, 50]);

describe("saved lecture ranges", () => {
  for (const header of [null, "bytes=1-3", "bytes=4-", "bytes=-2", "bytes=9-9", "nope"]) {
    it(`agrees on ${header ?? "the whole file"}`, () => {
      const fromTs = sliceRange(bytes, header);
      const fromWorker = rangeReply(bytes, header, "video/mp4");
      assert.equal(fromTs?.status ?? null, fromWorker?.status ?? null);
      assert.equal(fromTs?.body.length ?? 0, fromWorker?.body.length ?? 0);
    });
  }
});
