import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Phase 5 dialogs", () => {
  it("settings and calendar use the focus-trapped dialog, not a click-away div", () => {
    const settings = src("../src/components/planner/settings-page.tsx");
    const calendar = src("../src/components/planner/calendar-page.tsx");
    const kit = src("../src/components/ui/kit.tsx");
    assert.match(settings, /<Dialog/);
    assert.match(calendar, /<Dialog/);
    assert.doesNotMatch(settings, /<div[^>]*role="dialog"/);
    assert.doesNotMatch(settings, /role="alertdialog"/);
    assert.doesNotMatch(calendar, /<div[^>]*role="dialog"/);
    assert.match(settings, /resetTyped !== "DELETE"/);
    assert.match(settings, /createRecoveryPoint\("reset workspace"/);
    assert.match(kit, /e\.key === "Escape"/);
    assert.match(kit, /aria-label="Close"/);
  });
});
