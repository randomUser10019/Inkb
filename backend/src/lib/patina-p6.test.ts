import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FIRST_SITTING } from "@inkboard/shared/planner/day-board";
import { COPY } from "@inkboard/shared/copy";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Patina P6 — first sitting", () => {
  it("empty today is two chalk lines, not a product tour", () => {
    const onboard = src("../components/planner/onboarding.tsx");
    assert.equal(FIRST_SITTING.title, COPY.boardBlank);
    assert.equal(FIRST_SITTING.write, COPY.writeAClassFromWall);
    assert.equal(FIRST_SITTING.plan, COPY.layOutAPlan);
    assert.match(onboard, /chalk-num tabular">1/);
    assert.match(onboard, /chalk-num tabular">2/);
    assert.match(onboard, /openCommandPalette/);
    assert.match(onboard, /to="\/planner\/new"/);
    assert.doesNotMatch(onboard, /PLAN_TEMPLATES/);
    assert.doesNotMatch(onboard, /TemplateCard/);
    assert.doesNotMatch(onboard, /Skip for now/);
    assert.doesNotMatch(onboard, /The wall already has the exams/);
  });

  it("wizard skips the exam directory when a seal is already on the wall", () => {
    const wizard = src("../components/planner/wizard-page.tsx");
    const exam = src("../components/planner/wizard-exam.tsx");
    assert.match(wizard, /useSelectedExam/);
    assert.match(wizard, /setStep\(1\)/);
    assert.match(wizard, /writeExamId/);
    assert.match(wizard, /of 4/);
    assert.match(wizard, /eraser-wipe/);
    assert.doesNotMatch(wizard, /Exam, courses, pace, then preview/);
    assert.doesNotMatch(wizard, /examsByGroup/);
    assert.match(exam, /COPY.writeAnExam/);
    assert.match(exam, /WriteField/);
    assert.doesNotMatch(exam, /g.families/);
    assert.doesNotMatch(exam, /examsByGroup/);
    const courses = src("../components/planner/wizard-courses.tsx");
    assert.doesNotMatch(courses, /Tick the courses you want/);
  });
});
