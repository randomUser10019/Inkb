import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Desk chrome source contract", () => {
  it("rail uses Lucide icons and the five labels", () => {
    const margin = src("../components/folio/margin.tsx");
    assert.match(margin, /from "lucide-react"/);
    assert.match(margin, /House/);
    assert.match(margin, /Radio/);
    assert.match(margin, /Library/);
    assert.match(margin, /CalendarDays/);
    assert.match(margin, /Bookmark/);
    assert.match(margin, /ChevronLeft/);
    assert.doesNotMatch(margin, /<svg viewBox/);
    assert.match(margin, /desk-rail/);
    assert.match(margin, /desk-tabbar/);
    assert.match(margin, /desk-header/);
  });

  it("player and live pages stay full-bleed (compact shell)", () => {
    const play = src("../pages/play-page.tsx");
    const live = src("../pages/live-page.tsx");
    assert.match(play, /ClassPlayer/);
    assert.match(live, /AppShell compact/);
    assert.doesNotMatch(play, /createServerFn/);
    assert.doesNotMatch(live, /createServerFn/);
  });

  it("home is exam-first, not a question hero", () => {
    const home = src("../pages/home-page.tsx");
    assert.match(home, /Pick an exam/);
    assert.match(home, /ContinueCard/);
    assert.doesNotMatch(home, /What are you studying/);
    assert.doesNotMatch(home, /createServerFn/);
  });

  it("styles use a serif for headings and a sans for the UI", () => {
    const css = src("../styles.css");
    assert.match(css, /ibm-plex-sans/);
    assert.match(css, /source-serif-4/);
    assert.match(css, /--font-serif: "Source Serif 4"/);
    assert.match(css, /--color-primary: #d9d4c8/);
    assert.match(css, /--color-accent: #1aa88e/);
    assert.match(css, /--radius-board: 12px/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /--color-bg: #0e0f12/);
    assert.match(css, /\.desk-root/);
  });
});
