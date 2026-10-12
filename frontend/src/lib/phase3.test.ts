import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Phase 3 UX and a11y", () => {
  it("player more-tray has 44px rows and named controls", () => {
    const more = src("../components/player-more.tsx");
    const player = src("../components/class-player.tsx");
    assert.match(player, /PlayerMore/);
    assert.match(more, /COPY.moreControls/);
    assert.match(more, /COPY.mute/);
    assert.match(more, /COPY.fullscreen/);
    assert.match(more, /COPY.hideCamera/);
    assert.match(more, /COPY.sleep15/);
    assert.match(more, /COPY.nextClass/);
    assert.match(more, /COPY.notes/);
    assert.match(more, /COPY.fold/);
    assert.match(more, /Escape/);
    const css = src("../styles.css");
    assert.match(css, /player-more-row/);
    assert.match(css, /min-height:\s*44px/);
  });

  it("charts expose a data table for screen readers", () => {
    const kit = src("../components/ui/planner/kit.tsx");
    assert.match(kit, /<table className="sr-only"/);
    assert.match(kit, /<caption>/);
  });

  it("reduced-motion covers the Kalam motion catalog", () => {
    const css = src("../styles.css");
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    for (const name of ["chalk-draw", "eraser-wipe", "strike-draw", "tally-tick", "badge-shimmer", "live-pulse", "caret-blink"]) {
      assert.match(css, new RegExp(name));
    }
    assert.match(css, /\.chalk-draw,\s*\n\s*\.chalk-draw-2/s);
  });

  it("nav items have plain-language labels", () => {
    const margin = src("../components/folio/margin.tsx");
    assert.match(margin, /COPY.search/);
    assert.match(margin, /streakDaysCopy/);
    assert.match(margin, /DESK_ITEMS/);
    assert.match(margin, /COPY.home/);
    assert.match(margin, /House/);
    assert.match(margin, /Library/);
    const shortcuts = src("../components/planner/shortcuts.tsx");
    assert.match(shortcuts, /COPY.shortcuts/);
  });

  it("does not load Google Fonts and self-hosts IBM Plex Sans", () => {
    const root = src("../routes/__root.tsx");
    const css = src("../styles.css");
    assert.doesNotMatch(root, /fonts\.googleapis\.com/);
    assert.doesNotMatch(root, /fonts\.gstatic\.com/);
    assert.match(css, /@fontsource\/ibm-plex-sans/);
    assert.match(css, /@fontsource\/source-serif-4/);
    assert.match(css, /IBM Plex Sans Fallback/);
    assert.match(css, /size-adjust/);
  });

  it("planner stays on this device — no remote sync chip", () => {
    const sync = src("../components/planner-sync.tsx");
    assert.doesNotMatch(sync, /bottom-16/);
    assert.doesNotMatch(sync, /loadPlannerState/);
    assert.match(sync, /local-only/);
  });

  it("outline-none inputs keep a visible focus hairline", () => {
    const hub = src("../components/exam-hub.tsx");
    assert.match(hub, /focus-visible:ring/);
  });

  it("keeps seal type at 12px", () => {
    const css = src("../styles.css");
    assert.match(css, /\.text-seal\s*\{[^}]*font-size:\s*0\.75rem/s);
  });
});
