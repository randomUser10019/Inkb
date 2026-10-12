import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearUpstreamFail,
  isUpstreamOutage,
  noteUpstreamOk,
  readUpstreamFail,
  reportUpstreamFail,
} from "@inkboard/shared/upstream";

describe("upstream outage vs empty content", () => {
  it("treats 404/400 as empty, and 5xx/network as an outage", () => {
    assert.equal(isUpstreamOutage(new Error("Unacademy request failed (404)")), false);
    assert.equal(isUpstreamOutage(new Error("Unacademy request failed (400)")), false);
    assert.equal(isUpstreamOutage(new Error("Unacademy request failed (503)")), true);
    assert.equal(isUpstreamOutage(new Error("fetch failed")), true);
    assert.equal(isUpstreamOutage(new Error("The operation was aborted")), true);
    assert.equal(isUpstreamOutage(new Error("Request aborted")), false);
  });

  it("remembers a recent outage and forgets 404s", () => {
    clearUpstreamFail();
    reportUpstreamFail("hub", new Error("Unacademy request failed (404)"));
    assert.equal(readUpstreamFail(1_000), null);
    reportUpstreamFail("hub", new Error("Unacademy request failed (502)"));
    const hit = readUpstreamFail(1_000);
    assert.ok(hit);
    assert.equal(hit.scope, "hub");
    assert.equal(hit.status, 502);
    assert.equal(readUpstreamFail(hit.at + 6 * 60_000), null);
    reportUpstreamFail("hub", new Error("Unacademy request failed (502)"));
    noteUpstreamOk(readUpstreamFail()!.at + 1);
    assert.equal(readUpstreamFail(), null);
    noteUpstreamOk(5_000);
    reportUpstreamFail("hub", new Error("Unacademy request failed (503)"), 5_000 + 1_000);
    assert.equal(readUpstreamFail(6_000), null, "a page that just loaded does not raise the banner");
    reportUpstreamFail("hub", new Error("Unacademy request failed (503)"), 5_000 + 21_000);
    assert.equal(readUpstreamFail(26_000)?.status, 503);
    clearUpstreamFail();
    assert.equal(readUpstreamFail(), null);
  });
});
