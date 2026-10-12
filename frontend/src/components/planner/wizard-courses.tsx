import { EmptyState, TeacherSkeleton } from "@/components/skeleton";
import { hoursForCourse } from "@inkboard/shared/planner/syllabus";
import { chipMeta, courseForSubject, estimateHours, moveIndex, selectedTotals } from "@inkboard/shared/planner/wizard";
import type { PlanCourseInput } from "@inkboard/shared/planner/types";
import type { ExamTeacher, UaCourse } from "@/lib/unacademy";
import { useState } from "react";

export type CourseSuggestion = {
  subject: string;
  course: {
    uid: string;
    name: string;
    slug?: string;
    topic: string;
    lessonCount: number;
    authorName: string;
    authorUsername: string;
    thumbnail?: string;
  };
};

export function WizardCourses({
  teacherQ,
  teacherErr,
  onTeacherQ,
  onAddTeacher,
  suggestions,
  onSuggest,
  selected,
  onReorder,
  onRemove,
  balanceWarning,
  teachersLoading,
  teachers,
  extraTeachers,
  openTeacher,
  onOpenTeacher,
  eduLoading,
  courses,
  picked,
  speed,
  onPickCourse,
  moreOffset,
  loadingMore,
  onLoadMore,
  onBack,
  onNext,
}: {
  teacherQ: string;
  teacherErr: string;
  onTeacherQ: (v: string) => void;
  onAddTeacher: () => void;
  suggestions: CourseSuggestion[];
  onSuggest: (s: CourseSuggestion) => Promise<void> | void;
  selected: PlanCourseInput[];
  onReorder: (next: PlanCourseInput[]) => void;
  onRemove: (id: string) => void;
  balanceWarning: string | null;
  teachersLoading: boolean;
  teachers: ExamTeacher[];
  extraTeachers: ExamTeacher[];
  openTeacher: string;
  onOpenTeacher: (username: string) => void;
  eduLoading: boolean;
  courses: UaCourse[];
  picked: Record<string, PlanCourseInput>;
  speed: number;
  onPickCourse: (teacher: ExamTeacher, course: UaCourse) => void;
  moreOffset: number | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const list = [...extraTeachers, ...teachers].filter(
    (t, i, all) => all.findIndex((x) => x.username === t.username) === i,
  );
  const totals = selectedTotals(selected, speed);
  const [busyId, setBusyId] = useState<string | null>(null);

  function onDropChip(fromId: string, toId: string) {
    const from = selected.findIndex((c) => c.courseId === fromId);
    const to = selected.findIndex((c) => c.courseId === toId);
    if (from < 0 || to < 0) return;
    onReorder(moveIndex(selected, from, to));
  }

  async function applySuggest(s: CourseSuggestion) {
    setBusyId(s.course.uid);
    try {
      await onSuggest(s);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <form
        className="mt-4 flex gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onAddTeacher();
        }}
      >
        <input
          value={teacherQ}
          onChange={(e) => onTeacherQ(e.target.value)}
          placeholder="Or paste a teacher username"
          className="sheet-field min-w-0 flex-1"
        />
        <button type="submit" className="h-11 text-sm font-semibold text-primary">
          Add
        </button>
      </form>
      {teacherErr ? <p className="mt-2 text-sm text-danger">{teacherErr}</p> : null}

      {suggestions.length ? (
        <div className="mt-6">
          <p className="text-seal text-faint">Suggest one course per subject</p>
          <ul className="mt-2">
            {suggestions.slice(0, 8).map((s) => {
              const hours = estimateHours(s.course.lessonCount, speed);
              const current = courseForSubject(selected, s.subject);
              const on = current?.courseId === s.course.uid;
              const swap = Boolean(current && !on);
              return (
                <li key={s.course.uid} className="chalk-row">
                  <span className="chalk-line">
                    <span className="min-w-0 flex-1">
                      <span className="chalk-title">
                        {s.subject} · {s.course.name}
                      </span>
                      <span className="chalk-meta">
                        {s.course.lessonCount} classes · ~{hours}h · {s.course.authorName}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={on || busyId === s.course.uid}
                      onClick={() => void applySuggest(s)}
                      className="h-11 shrink-0 text-sm text-primary disabled:opacity-50"
                    >
                      {on ? "Added" : swap ? "Swap" : busyId === s.course.uid ? "…" : "Add"}
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {selected.length ? (
        <>
          <p className="mt-6 text-caption text-muted">
            {totals.courses} course{totals.courses === 1 ? "" : "s"} · {totals.playable} lectures · {totals.hours}h
            total. First line is scheduled first.
          </p>
          <ol className="mt-2">
            {selected.map((c, i) => {
              const meta = chipMeta(c, speed);
              return (
                <li
                  key={c.courseId}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", c.courseId)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    onDropChip(e.dataTransfer.getData("text/plain"), c.courseId);
                  }}
                  className="chalk-row"
                >
                  <span className="chalk-line">
                    <span className="chalk-num tabular">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="chalk-title">{c.title}</span>
                      <span className="chalk-meta">{meta.label}</span>
                    </span>
                    <span className="chalk-actions">
                      {i > 0 ? (
                        <button
                          type="button"
                          className="h-11 px-2 text-caption text-muted"
                          aria-label="Move earlier"
                          onClick={() => onReorder(moveIndex(selected, i, i - 1))}
                        >
                          ‹
                        </button>
                      ) : null}
                      {i < selected.length - 1 ? (
                        <button
                          type="button"
                          className="h-11 px-2 text-caption text-muted"
                          aria-label="Move later"
                          onClick={() => onReorder(moveIndex(selected, i, i + 1))}
                        >
                          ›
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="h-11 px-2 text-caption text-danger"
                        aria-label={`Remove ${c.title}`}
                        onClick={() => onRemove(c.courseId)}
                      >
                        ×
                      </button>
                    </span>
                    <span className="sr-only">Priority {i + 1}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
      {balanceWarning ? <p className="mt-2 text-sm text-warn">{balanceWarning}</p> : null}
      {teachersLoading ? (
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <TeacherSkeleton key={i} />
          ))}
        </div>
      ) : list.length ? (
        <ul className="mt-6">
          {list.map((t) => {
            const open = openTeacher === t.username;
            return (
              <li key={t.username}>
                <button
                  type="button"
                  onClick={() => onOpenTeacher(open ? "" : t.username)}
                  className="stamp-hit w-full text-left"
                >
                  {t.avatar ? (
                    <img src={t.avatar} alt="" width={56} height={56} className="stamp-face" />
                  ) : (
                    <span className="stamp-face stamp-initials">{t.name[0]}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-serif">{t.name}</span>
                    <span className="block text-caption text-muted">@{t.username}</span>
                  </span>
                </button>
                {open ? (
                  <ul className="mb-3 ml-16">
                    {eduLoading ? (
                      <li className="py-2" aria-hidden="true">
                        <div className="line-skel" />
                      </li>
                    ) : (
                      courses.map((c) => {
                        const on = Boolean(picked[c.uid]);
                        const stats = on ? hoursForCourse(picked[c.uid]!, speed) : null;
                        return (
                          <li key={c.uid} className="chalk-row">
                            <label className="chalk-line cursor-pointer" aria-label={c.name}>
                              <input type="checkbox" className="mt-1" checked={on} onChange={() => onPickCourse(t, c)} />
                              <span className="min-w-0 flex-1">
                                <span className={`chalk-title${on ? " text-primary" : ""}`}>{c.name}</span>
                                <span className="chalk-meta">
                                  {stats
                                    ? `${stats.playable} playable · ${stats.hours}h${
                                        stats.skipped ? ` · ${stats.skipped} not available` : ""
                                      }`
                                    : `${c.itemCount} classes`}
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })
                    )}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No teachers listed" body="Pick another exam, or search a teacher and add them from their page." />
      )}
      {moreOffset != null ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mt-3 h-11 text-sm text-muted disabled:opacity-50"
        >
          {loadingMore ? "Show more teachers" : "Show more teachers"}
        </button>
      ) : null}
      <div className="mt-6 flex justify-between">
        <button type="button" className="h-11 text-sm text-muted" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          disabled={!selected.length}
          onClick={onNext}
          className="h-11 text-sm font-semibold text-primary disabled:opacity-50"
        >
          Pace
        </button>
      </div>
    </div>
  );
}
