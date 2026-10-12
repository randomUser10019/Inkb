import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Keep this class is reachable", () => {
  it("wires the player, shelf, ledger, and Write Line", () => {
    const player = src("../components/class-player.tsx");
    const more = src("../components/player-more.tsx");
    const course = src("../routes/course.$courseId.tsx");
    const ledger = src("../components/folio/ledger.tsx");
    const palette = src("./command-palette.ts");
    const locker = src("../components/notes-locker.tsx");
    assert.match(player, /onKeepClass/);
    assert.match(player, /SaveClassDialog/);
    assert.match(more, /COPY\.keepThisClass/);
    assert.match(course, /SaveClassButton/);
    assert.match(course, /variant="line"/);
    assert.match(ledger, /COPY\.savedClasses/);
    assert.match(ledger, /to="\/offline"/);
    assert.match(palette, /offline saved classes/);
    assert.match(locker, /COPY\.notesArePdfs/);
  });
});
