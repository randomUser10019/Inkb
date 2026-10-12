import { catalogMetaClass, catalogRowClass, catalogTitleClass } from "@/components/catalog-row";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { fmtWhen } from "@inkboard/shared/exam-wall";
import { initialsFrom } from "@inkboard/shared/initials";
import { subjectHatchClassFor } from "@inkboard/shared/planner/subjects";
import {
  loadCourseDetail,
  loadEducatorPage,
  type CrashDoor as CrashDoorRow,
  type ExamCourse,
  type ExamPlaylist,
  type ExamTeacher,
  type LiveSlot,
} from "@/lib/unacademy";
import { COPY } from "@inkboard/shared/copy";

export function LiveDoor({ slot, withDay }: { slot: LiveSlot; withDay?: boolean }) {
  const live = slot.status === "live";
  const inner = (
    <>
      <span className="desk-when">
        {live ? (
          <>
            <span className="live-dot" aria-hidden="true" />
            <span className="text-danger">Live</span>
          </>
        ) : (
          <span className="tabular text-muted">{fmtWhen(slot.liveAt, withDay)}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={catalogTitleClass}>{slot.title}</span>
        <span className={catalogMetaClass}>{slot.authorName || slot.authorUsername}</span>
      </span>
    </>
  );
  const cls = `live-door${live ? " is-live" : ""}`;
  if (slot.replayId && !live) {
    return (
      <Link
        to="/play/$lessonId"
        params={{ lessonId: slot.replayId }}
        search={{ title: slot.title, teacher: slot.authorUsername }}
        className={cls}
      >
        {inner}
      </Link>
    );
  }
  return (
    <Link
      to="/live/$classId"
      params={{ classId: slot.classUid }}
      search={{ slug: slot.classSlug }}
      className={cls}
    >
      {inner}
    </Link>
  );
}

export function CrashDoor({ door }: { door: CrashDoorRow }) {
  const inner = (
    <>
      <span className={`desk-tick ${subjectHatchClassFor(door.name)}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={catalogTitleClass}>{door.name}</span>
        <span className={catalogMetaClass}>
          {COPY.crash}
          {door.authorName ? ` · ${door.authorName}` : door.kind === "batch" ? " · Batch" : " · Course"}
        </span>
      </span>
    </>
  );
  if (door.kind === "batch") {
    return (
      <Link to="/batch/$batchId" params={{ batchId: door.uid }} search={{ slug: door.slug }} className="live-door">
        {inner}
      </Link>
    );
  }
  return (
    <Link to="/course/$courseId" params={{ courseId: door.uid }} search={{ slug: door.slug || undefined }} className="live-door">
      {inner}
    </Link>
  );
}

export function SubjectPlate({
  name,
  caption,
  selected,
  onSelect,
}: {
  name: string;
  caption: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`subject-plate${selected ? " is-on" : ""}`}
      aria-pressed={selected}
      aria-label={`${name}. ${caption}`}
    >
      <span className={`plate-seal desk-tick ${subjectHatchClassFor(name)}`} aria-hidden="true" />
      <span className="plate-copy">
        <span className="plate-name">{name}</span>
        <span className="plate-caption">{caption}</span>
      </span>
    </button>
  );
}

/** P0: leftover chip API — a mute word, never a pill. */
export function HatchChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className={`caption-opt${selected ? " is-on" : ""}`} aria-pressed={selected}>
      {label === "all" ? "All" : label}
    </button>
  );
}

export function CourseIndex({ c, inPlan }: { c: ExamCourse; inPlan?: boolean }) {
  const qc = useQueryClient();
  const live = c.status === "live";
  const kicker = live ? "Live" : c.topic || "Course";
  const meta = [
    c.authorName || c.authorUsername,
    c.lessonCount ? `${c.lessonCount} ${c.lessonCount === 1 ? "class" : "classes"}` : "",
    inPlan ? "In plan" : "",
    c.liveAt && !live ? fmtWhen(c.liveAt, true) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const inner = (
    <>
      <span className={`desk-tick ${subjectHatchClassFor(c.topic || c.name)}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={catalogTitleClass}>{c.name}</span>
        <span className={catalogMetaClass}>
          {kicker}
          {meta ? ` · ${meta}` : ""}
        </span>
      </span>
    </>
  );
  const cls = catalogRowClass;
  if (live && c.classUid) {
    return (
      <Link
        to="/live/$classId"
        params={{ classId: c.classUid }}
        search={{ slug: c.classSlug || undefined }}
        className={cls}
      >
        {inner}
      </Link>
    );
  }
  if (c.replayId && !live && c.lessonCount <= 1) {
    return (
      <Link
        to="/play/$lessonId"
        params={{ lessonId: c.replayId }}
        search={{ title: c.name, teacher: c.authorUsername, course: c.uid }}
        className={cls}
      >
        {inner}
      </Link>
    );
  }
  return (
    <Link
      to="/course/$courseId"
      params={{ courseId: c.uid }}
      search={{ slug: c.slug || undefined, teacher: c.authorUsername }}
      onMouseEnter={() => {
        void qc.prefetchQuery({
          queryKey: ["course", "v7", c.uid],
          queryFn: () => loadCourseDetail({ data: { uid: c.uid, slug: c.slug, teacher: c.authorUsername } }),
        });
      }}
      className={cls}
    >
      {inner}
    </Link>
  );
}

export function PlaylistIndex({ p }: { p: ExamPlaylist }) {
  const inner = (
    <>
      <span className={`desk-tick ${subjectHatchClassFor(p.topic || p.name)}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={catalogTitleClass}>{p.name}</span>
        <span className={catalogMetaClass}>
          {p.topic || "Course"}
          {p.authorName || p.authorUsername ? ` · ${p.authorName || p.authorUsername}` : ""}
          {p.lessonCount ? ` · ${p.lessonCount} classes` : ""}
        </span>
      </span>
    </>
  );
  const realCourse = Boolean(p.courseUid && p.courseSlug && p.courseSlug.includes("-") && p.courseUid !== p.uid);
  if (realCourse && p.courseUid) {
    return (
      <Link
        to="/course/$courseId"
        params={{ courseId: p.courseUid }}
        search={{ slug: p.courseSlug || undefined, teacher: p.authorUsername }}
        className={catalogRowClass}
      >
        {inner}
      </Link>
    );
  }
  if (p.authorUsername) {
    return (
      <Link to="/teacher/$slug" params={{ slug: p.authorUsername }} className={catalogRowClass}>
        {inner}
      </Link>
    );
  }
  return <div className={catalogRowClass}>{inner}</div>;
}

export function TeacherStamp({ t }: { t: ExamTeacher }) {
  const qc = useQueryClient();
  const mark = initialsFrom(t.name) || t.username.slice(0, 2).toUpperCase();
  return (
    <Link
      to="/teacher/$slug"
      params={{ slug: t.username }}
      onMouseEnter={() => {
        void qc.prefetchQuery({
          queryKey: ["educator", t.username.toLowerCase(), "latest"],
          queryFn: () => loadEducatorPage({ data: { username: t.username, sort: "latest", offset: 0 } }),
        });
      }}
      className="teacher-stamp"
    >
      <span className="stamp-mat" aria-hidden={Boolean(t.avatar)}>
        {t.avatar ? (
          <img src={t.avatar} alt="" loading="lazy" decoding="async" className="stamp-face" width={136} height={136} />
        ) : (
          <span className="stamp-face stamp-initials">{mark}</span>
        )}
      </span>
      <span className="engraved">{t.name}</span>
    </Link>
  );
}

export function DoorRow({ children }: { children: ReactNode }) {
  return <div className="door-row">{children}</div>;
}

export function PlateGrid({ children }: { children: ReactNode }) {
  return <div className="plate-grid">{children}</div>;
}

export function StampRack({ children }: { children: ReactNode }) {
  return <div className="stamp-rack">{children}</div>;
}

export function IndexShelf({ children }: { children: ReactNode }) {
  return <div className="index-shelf">{children}</div>;
}
