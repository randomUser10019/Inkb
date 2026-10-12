import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Patina P0 — third language gone from paint", () => {
  it("course shelf has a write field, not chips or a notes locker widget", () => {
    const course = src("../pages/course-page.tsx");
    assert.match(course, /WriteField/);
    assert.match(course, /Find a class/);
    assert.match(course, /useShelfLedger/);
    assert.match(course, /sheetsCopy|notesCount/);
    assert.doesNotMatch(course, /Browse/);
    assert.doesNotMatch(course, /Download all/);
    assert.doesNotMatch(course, /Filter classes/);
    assert.doesNotMatch(course, /All ·/);
    assert.doesNotMatch(course, /Replay ·/);
    assert.doesNotMatch(course, /FilterChip/);
  });

  it("exam wall and teacher shelves switch plates with mute words, not hatch chips", () => {
    const hub = src("../components/exam-hub.tsx");
    const teacher = src("../components/educator-catalog.tsx");
    assert.doesNotMatch(hub, /HatchChip/);
    assert.doesNotMatch(teacher, /HatchChip/);
    assert.match(hub, /MuteWord/);
    assert.match(teacher, /MuteWord/);
    assert.doesNotMatch(hub, /LOADING/);
    assert.doesNotMatch(hub, /All \d+ stamps/);
  });

  it("loading is line skeletons, never the word LOADING", () => {
    const painted = [
      "../pages/exam-page.tsx",
      "../pages/course-page.tsx",
      "../components/educator-catalog.tsx",
      "../components/skeleton.tsx",
      "../components/class-player.tsx",
    ];
    for (const file of painted) {
      assert.doesNotMatch(src(file), /LOADING/);
      assert.doesNotMatch(src(file), /Loading…/);
    }
    assert.match(src("../components/skeleton.tsx"), /line-skel/);
  });

  it("catch-up is an inscription, the old today card is gone, player chip is unpainted", () => {
    assert.doesNotMatch(src("../components/planner/dashboard-page.tsx"), /BehindBanner/);
    assert.doesNotMatch(src("../components/planner/calendar-page.tsx"), /BehindBanner/);
    assert.doesNotMatch(src("../components/planner/today-page.tsx"), /BehindBanner/);
    assert.match(src("../components/planner/dashboard-page.tsx"), /CatchUpLines/);
    const chip = src("../components/planner-chip.tsx");
    assert.match(chip, /return null/);
  });
});

describe("Patina P1 — ledger is a desk", () => {
  it("home does not paint continue-watching or a planner card", () => {
    const home = src("../pages/home-page.tsx");
    assert.doesNotMatch(home, /ContinueWatching/);
    assert.doesNotMatch(home, /PlannerTodayCard/);
    assert.match(home, /Pick an exam/);
  });

  it("the ledger never lists the exam directory, and peek tells the truth", () => {
    const ledger = src("../components/folio/ledger.tsx");
    assert.doesNotMatch(ledger, /examsByGroup/);
    assert.doesNotMatch(ledger, /ExamCatalog/);
    assert.doesNotMatch(ledger, /ContinueWatching/);
    assert.match(ledger, /showExamDesk/);
    assert.match(ledger, /showPlateDesk/);
    assert.match(ledger, /Recent/);
    assert.match(ledger, /sheetsCopy/);
    assert.match(ledger, /peekCopy/);
    assert.match(src("../../../shared/src/lib/folio.ts"), /Blank · pull/);
  });
});
