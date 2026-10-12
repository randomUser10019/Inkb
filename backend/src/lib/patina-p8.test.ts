import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { coursesCopy } from "@inkboard/shared/copy";
import { frameCrowd, plateCaption } from "@inkboard/shared/exam-wall";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Patina P8 — voice of the wall", () => {
  it("never paints playlist, learners, or Plus as chrome", () => {
    const hub = src("../components/exam-hub.tsx");
    const wall = src("../components/folio/wall.tsx");
    const teacher = src("../components/educator-catalog.tsx");
    const course = src("../routes/course.$courseId.tsx");
    const live = src("../routes/live.$classId.tsx");
    const wizard = src("../components/planner/wizard-page.tsx");
    const prefs = src("../components/planner/wizard-prefs.tsx");
    const archived = src("../components/archived-lesson.tsx");

    assert.doesNotMatch(wall, /"Playlist"/);
    assert.doesNotMatch(hub, /Plus courses/);
    assert.doesNotMatch(hub, /All \d+ stamps/);
    assert.doesNotMatch(teacher, /learners/i);
    assert.doesNotMatch(teacher, /plus batches/i);
    assert.doesNotMatch(course, /playlists, not courses/);
    assert.doesNotMatch(course, /Plus course/);
    assert.doesNotMatch(live, /Replay incoming/);
    assert.match(live, /COPY.boardIsComing/);
    assert.doesNotMatch(live, /watching/);
    assert.match(hub, /COPY.stamps/);
    assert.match(hub, /COPY.rackEmpty/);
    assert.match(hub, /COPY.restOfTheRack/);
    assert.doesNotMatch(hub, /No teachers listed/);
    assert.doesNotMatch(wizard, /playlist\$\{/);
    assert.match(wizard, /coursesCopy/);
    assert.doesNotMatch(prefs, /Playlist mode/);
    assert.match(prefs, /How courses mix/);
    assert.doesNotMatch(hub, /GATE paper sit/);
    assert.doesNotMatch(hub, /Super 30 layer/);
    assert.match(course, /courseSeal/);
    assert.doesNotMatch(teacher, /one-off sessions/);
    assert.doesNotMatch(archived, /Download notes/);
    assert.match(archived, /Take the sheets/);
  });

  it("frames counts without catalog chrome", () => {
    assert.equal(plateCaption({ courses: 11, playlists: 1 }), "12 courses");
    assert.doesNotMatch(plateCaption({ courses: 11, playlists: 1 }), /playlist/i);
    assert.equal(coursesCopy(11), "11 courses");
    assert.equal(frameCrowd(94200), "94 thousand");
    assert.doesNotMatch(frameCrowd(94200), /learners/i);
  });

  it("live doors are signs, not view-count cards", () => {
    const wall = src("../components/folio/wall.tsx");
    assert.doesNotMatch(wall, /watching/);
    assert.match(wall, /LiveDoor/);
    assert.doesNotMatch(wall, /lucide-react/);
  });
});
