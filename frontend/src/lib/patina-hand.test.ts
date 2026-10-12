import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ERASER_MS, STRIKE_MS, tallyGroups, tallyTickIndex } from "@inkboard/shared/hand";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Patina P2 — the hand", () => {
  it("groups tally marks in fives and ticks only the new stroke", () => {
    assert.deepEqual(tallyGroups(0), []);
    assert.deepEqual(tallyGroups(4), [4]);
    assert.deepEqual(tallyGroups(5), [5]);
    assert.deepEqual(tallyGroups(6), [5, 1]);
    assert.equal(tallyTickIndex(null, 4), null);
    assert.equal(tallyTickIndex(4, 4), null);
    assert.equal(tallyTickIndex(4, 5), 4);
    assert.equal(tallyTickIndex(0, 1), 0);
  });

  it("strike draws on complete, skip-on-load, undo erases — no celebration toast", () => {
    const css = src("../styles.css");
    const shelf = src("../components/folio/shelf.tsx");
    const row = src("../components/planner/task-row.tsx");
    const tally = src("../components/folio/tally.tsx");
    const shell = src("../components/folio/shell.tsx");
    const hub = src("../components/exam-hub.tsx");
    const player = src("../components/class-player.tsx");
    assert.match(shelf, /function StrikeTitle/);
    assert.match(shelf, /is-ready/);
    assert.match(shelf, /is-on/);
    assert.match(row, /StrikeTitle/);
    assert.doesNotMatch(row, /Marked done/);
    assert.match(css, /strike-title\.is-ready:after/);
    assert.match(css, /240ms|--duration-strike/);
    assert.match(tally, /tallyTickIndex/);
    assert.match(tally, /tally-tick/);
    assert.match(css, /eraser-wipe/);
    assert.match(shell, /desk-root/);
    assert.match(shell, /pathname/);
    assert.match(hub, /key=\{faced/);
    assert.match(player, /PLAYER_IDLE_MS/);
    assert.equal(STRIKE_MS, 240);
    assert.equal(ERASER_MS, 320);
  });
});

describe("Patina P3 — shelves and one Write", () => {
  it("empty /search is a focused write field, shares with ?q= still render hits", () => {
    const search = src("../pages/search-page.tsx");
    const palette = src("../../../shared/src/lib/command-palette.ts");
    assert.match(search, /COPY\.writeWhere/);
    assert.match(search, /autoFocus/);
    assert.match(search, /usernameFromQuery/);
    assert.match(search, /usernameIfNoHits/);
    assert.match(search, /pushRecent/);
    assert.doesNotMatch(search, /openCommandPalette/);
    assert.doesNotMatch(search, /isUsernameQuery/);
    assert.doesNotMatch(search, /WriteField/);
    assert.doesNotMatch(search, /RecentSearches/);
    assert.match(palette, /openCommandPalette\(seed/);
    assert.match(search, /lookup\.data/);
  });

  it("teacher paint has no learners, course brief stays folded, batch is lined", () => {
    const teacher = src("../components/educator-catalog.tsx");
    const course = src("../pages/course-page.tsx");
    const batch = src("../pages/batch-page.tsx");
    assert.match(teacher, /<Brief /);
    assert.doesNotMatch(teacher, /learners/i);
    assert.doesNotMatch(teacher, /followers/);
    assert.match(course, /<Brief /);
    assert.match(batch, /<Brief /);
    assert.match(batch, /view === "list"/);
    assert.match(batch, /WriteField/);
  });
});
