import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rangeReply } from "../../../public/offline-range.js";
import { sliceRange } from "./range.ts";

const file = new Uint8Array([0, 1, 2, 3, 4]);

describe("saved lecture seek", () => {
  it("returns the requested bytes from both copies of the helper", () => {
    const fromWorker = rangeReply(file, "bytes=1-3", "video/mp4");
    const fromApp = sliceRange(file, "bytes=1-3");
    assert.equal(fromWorker?.status, 206);
    assert.equal(fromApp?.status, 206);
    assert.deepEqual([...(fromWorker?.body ?? [])], [1, 2, 3]);
    assert.deepEqual([...(fromApp?.body ?? [])], [1, 2, 3]);
  });

  it("serves the last bytes when the player asks for a suffix", () => {
    const reply = sliceRange(file, "bytes=-2");
    assert.equal(reply?.status, 206);
    assert.deepEqual([...(reply?.body ?? [])], [3, 4]);
    assert.equal(reply?.contentRange, "bytes 3-4/5");
  });

  it("refuses a range past the end", () => {
    const reply = sliceRange(new Uint8Array([0, 1, 2]), "bytes=9-10");
    assert.equal(reply?.status, 416);
    assert.equal(reply?.contentRange, "bytes */3");
  });
});
