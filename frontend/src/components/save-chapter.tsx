import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog } from "@/components/ui/kit";
import {
  buildChapter,
  chapterFileSlug,
  formatChapterDuration,
  playableReplays,
  saveChapterCommand,
  saveLectureCommand,
  totalDurationMs,
  type CatalogLesson,
  type Chapter,
} from "@inkboard/shared/bundle/chapter";
import {
  buildCourse,
  courseDurationMs,
  courseFileSlug,
  courseLectureCount,
  saveCourseCommand,
  type Course,
} from "@inkboard/shared/bundle/course";
import { COPY } from "@inkboard/shared/copy";
import { apiJson } from "@/lib/api-client";
import { parseSpriteSheet, type PreparedMedia } from "@/lib/sprite-sheet";
import { parseSilenceFile } from "@/lib/study";

export function SaveChapterButton({
  courseId,
  courseTitle,
  chapterId,
  chapterTitle,
  lessons,
}: {
  courseId: string;
  courseTitle: string;
  chapterId: string;
  chapterTitle: string;
  lessons: CatalogLesson[];
}) {
  const [open, setOpen] = useState(false);
  const playable = playableReplays(lessons);
  if (!playable.length) return null;
  return (
    <>
      <button
        type="button"
        className="h-11 text-sm text-muted hover:text-fg"
        aria-label={COPY.keepThisWeek}
        onClick={() => setOpen(true)}
      >
        {COPY.keepThisWeek}
      </button>
      {open ? (
        <SaveChapterDialog
          courseId={courseId}
          courseTitle={courseTitle}
          chapterId={chapterId}
          chapterTitle={chapterTitle}
          lessons={lessons}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function SaveCourseButton({
  courseId,
  courseTitle,
  groups,
}: {
  courseId: string;
  courseTitle: string;
  groups: { week: number | null; lessons: CatalogLesson[] }[];
}) {
  const [open, setOpen] = useState(false);
  const chapters = groups.map((g) => ({
    chapterId: g.week != null ? `${courseId}-week-${g.week}` : `${courseId}-all`,
    chapterTitle: g.week != null ? `Week ${g.week}` : courseTitle,
    lessons: g.lessons,
  }));
  let course: Course | null = null;
  try {
    course = buildCourse({ courseId, courseTitle, chapters });
  } catch {
    course = null;
  }
  if (!course || !courseLectureCount(course)) return null;
  return (
    <>
      <button
        type="button"
        className="h-11 text-sm text-muted hover:text-fg"
        aria-label={COPY.keepTheCourse}
        onClick={() => setOpen(true)}
      >
        {COPY.keepTheCourse}
      </button>
      {open ? <SaveCourseDialog course={course} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SaveChapterDialog({
  courseId,
  courseTitle,
  chapterId,
  chapterTitle,
  lessons,
  onClose,
}: {
  courseId: string;
  courseTitle: string;
  chapterId: string;
  chapterTitle: string;
  lessons: CatalogLesson[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [sortByPart, setSortByPart] = useState(false);
  const playable = playableReplays(lessons);
  const tooMany = playable.length > 30;
  const chapter: Chapter | null = useMemo(() => {
    if (tooMany || playable.length === 0) return null;
    try {
      return buildChapter({ courseId, courseTitle, chapterId, chapterTitle, lessons, sortByPart });
    } catch {
      return null;
    }
  }, [courseId, courseTitle, chapterId, chapterTitle, lessons, playable.length, tooMany, sortByPart]);
  const slug = chapter ? chapterFileSlug(chapter.chapterTitle, chapter.chapterId) : "";
  const command = slug ? saveChapterCommand(slug) : "";
  const total = chapter ? formatChapterDuration(totalDurationMs(chapter.lectures)) : "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function download() {
    if (!chapter || !slug) return;
    const blob = new Blob([`${JSON.stringify(chapter, null, 2)}\n`], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `chapter-${slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <SaveDialogShell titleId="save-chapter-title" title={COPY.keepThisWeek} onClose={onClose}>
      {tooMany ? (
        <p className="mt-3 text-sm text-muted">
          This week has {playable.length} playable lectures. The saver will not take more than 30. Split the week, or use Save whole course.
        </p>
      ) : chapter ? (
        <>
          <p className="mt-3 text-sm text-muted">
            {chapter.lectures.length} lectures · {total}. Downloads run on your computer, one lecture at a time. Archived lectures are skipped.
          </p>
          <SortByPartToggle checked={sortByPart} onChange={setSortByPart} />
          <p className="mt-4 font-mono text-xs text-fg">{command}</p>
          <DialogActions onDownload={download} onCopy={() => void copy()} copied={copied} onClose={onClose} downloadLabel={COPY.downloadList} />
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">No playable replays in this week yet.</p>
      )}
    </SaveDialogShell>
  );
}

function SaveCourseDialog({ course: base, onClose }: { course: Course; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [sortByPart, setSortByPart] = useState(false);
  const course = useMemo(() => {
    if (!sortByPart) return base;
    try {
      return buildCourse({
        courseId: base.courseId,
        courseTitle: base.courseTitle,
        createdAt: base.createdAt,
        chapters: base.chapters.map((ch) => ({
          chapterId: ch.chapterId,
          chapterTitle: ch.chapterTitle,
          lessons: ch.lectures.map((l) => ({
            replayId: l.lessonId,
            title: l.title,
            durationSec: l.durationMs / 1000,
            playable: true,
            status: "replay",
          })),
        })),
        sortByPart: true,
      });
    } catch {
      return base;
    }
  }, [base, sortByPart]);
  const slug = courseFileSlug(course.courseTitle, course.courseId);
  const command = saveCourseCommand(slug);
  const total = formatChapterDuration(courseDurationMs(course));
  const n = courseLectureCount(course);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function download() {
    const blob = new Blob([`${JSON.stringify(course, null, 2)}\n`], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `course-${slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <SaveDialogShell titleId="save-course-title" title={COPY.keepTheCourse} onClose={onClose}>
      <p className="mt-3 text-sm text-muted">
        {course.chapters.length} weeks · {n} lectures · {total}. Runs on your computer, one lecture at a time, up to 30 lectures per run. Archived lectures are skipped. Re-run the same command to continue.
      </p>
      <SortByPartToggle checked={sortByPart} onChange={setSortByPart} />
      <p className="mt-4 font-mono text-xs text-fg">{command}</p>
      <DialogActions onDownload={download} onCopy={() => void copy()} copied={copied} onClose={onClose} downloadLabel={COPY.downloadList} />
    </SaveDialogShell>
  );
}

function SortByPartToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mt-4 flex h-11 cursor-pointer items-center gap-2 text-sm text-muted">
      <input
        type="checkbox"
        className="size-4 accent-[var(--oxide)]"
        checked={checked}
        aria-label="Sort by part number"
        onChange={(e) => onChange(e.target.checked)}
      />
      Sort by part number
    </label>
  );
}

function SaveDialogShell({
  titleId,
  title,
  onClose,
  children,
}: {
  titleId: string;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog title={title} titleId={titleId} onClose={onClose}>
      {children}
      <p className="mt-4 text-xs text-faint">
        Personal study only. Not affiliated with Unacademy. Do not share the saved folders.
      </p>
    </Dialog>
  );
}

function DialogActions({
  onDownload,
  onCopy,
  copied,
  onClose,
  downloadLabel,
}: {
  onDownload: () => void;
  onCopy: () => void;
  copied: boolean;
  onClose: () => void;
  downloadLabel: string;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" className="rail-btn" onClick={onDownload}>
        {downloadLabel}
      </button>
      <button type="button" className="rail-btn" onClick={onCopy}>
          {copied ? "Copied" : COPY.copyCommand}
      </button>
      <button type="button" className="rail-btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export function SaveClassButton({
  lessonId,
  title,
  variant = "button",
}: {
  lessonId: string;
  title: string;
  variant?: "button" | "line";
}) {
  const [open, setOpen] = useState(false);
  let command = "";
  try {
    command = saveLectureCommand(lessonId);
  } catch {
    return null;
  }
  return (
    <>
      <button
        type="button"
        className={
          variant === "line"
            ? "ink-underline h-11 px-1 text-caption text-muted"
            : "h-11 text-sm text-muted hover:text-fg"
        }
        aria-label={COPY.keepThisClass}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {COPY.keepThisClass}
      </button>
      {open ? <SaveClassDialog lessonId={lessonId} title={title} command={command} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

export function SaveClassDialog({
  lessonId,
  title,
  command,
  onClose,
  onPrepared,
}: {
  lessonId: string;
  title: string;
  command?: string;
  onClose: () => void;
  onPrepared?: (pack: PreparedMedia) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [jobId, setJobId] = useState("");
  const [jobState, setJobState] = useState("");
  const [jobStep, setJobStep] = useState("");
  const [jobError, setJobError] = useState("");
  const preparedRef = useRef(onPrepared);
  preparedRef.current = onPrepared;
  const line = command || saveLectureCommand(lessonId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!jobId || jobState === "done" || jobState === "error" || jobState === "cancelled") return;
    let dead = false;
    const tick = async () => {
      try {
        const next = await apiJson<{ id: string; state: string; step: string; error?: string }>(`/api/jobs/${jobId}`);
        if (dead) return;
        setJobState(next.state);
        setJobStep(next.step || "");
        setJobError(next.error || "");
        if (next.state !== "done") return;
        const base = `/api/jobs/${jobId}/artifacts`;
        const report = await apiJson<{ steps?: { name: string; ok: boolean }[] }>(`${base}/enhance.json`).catch(() => null);
        const ok = (name: string) => Boolean(report?.steps?.some((s) => s.ok && (s.name === name || s.name.startsWith(name))));
        let sprites: PreparedMedia["sprites"] = null;
        if (!report || ok("sprites")) {
          const raw = await apiJson<unknown>(`${base}/sprites.json`).catch(() => null);
          sprites = raw ? parseSpriteSheet(raw, `${base}/sprites.webp`) : null;
        }
        let silence: PreparedMedia["silence"] = null;
        if (!report || ok("silence")) {
          const raw = await apiJson<unknown>(`${base}/silence.json`).catch(() => null);
          silence = raw ? parseSilenceFile(raw) : null;
        }
        preparedRef.current?.({
          sprites,
          audioUrl: !report || ok("loudnorm") || ok("audio") ? `${base}/audio.m4a` : null,
          hlsUrl: !report || ok("hls") ? `${base}/hls/master.m3u8` : null,
          silence,
          waveformUrl: !report || ok("waveform") ? `${base}/waveform.png` : null,
          jobId,
        });
      } catch (err) {
        if (dead) return;
        setJobState("error");
        setJobError(err instanceof Error ? err.message : COPY.slateSlipped);
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      dead = true;
      window.clearInterval(id);
    };
  }, [jobId, jobState]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  async function prepare() {
    setJobError("");
    setJobState("queued");
    setJobStep(COPY.preparingMedia);
    try {
      const created = await apiJson<{ id: string; state: string; step: string }>("/api/jobs/lectures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: lessonId, title, remux: true, enhance: true }),
      });
      setJobId(created.id);
      setJobState(created.state);
      setJobStep(created.step || COPY.preparingMedia);
    } catch (err) {
      setJobState("error");
      setJobError(err instanceof Error ? err.message : COPY.slateSlipped);
    }
  }

  const preparing = jobState === "queued" || jobState === "running";

  return (
    <SaveDialogShell titleId="save-class-title" title={COPY.keepThisClass} onClose={onClose}>
      <p className="mt-2 font-serif text-sm">{title}</p>
      <p className="mt-3 text-sm text-muted">{COPY.keepClassHint}</p>
      <p className="mt-4 font-mono text-xs text-fg">{line}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rail-btn" onClick={() => void copy()}>
          {copied ? "Copied" : COPY.copyCommand}
        </button>
        <button type="button" className="rail-btn" disabled={preparing} onClick={() => void prepare()}>
          {preparing ? COPY.preparingMedia : COPY.prepareMedia}
        </button>
        <Link to="/offline" className="rail-btn" onClick={onClose}>
          {COPY.savedClasses}
        </Link>
        <button type="button" className="rail-btn" onClick={onClose}>
          Close
        </button>
      </div>
      {jobStep ? <p className="mt-3 text-caption text-muted">{jobState === "done" ? COPY.mediaReady : jobStep}</p> : null}
      {jobError ? <p className="mt-2 text-caption text-muted">{jobError}</p> : null}
      {jobState === "done" && jobStep.includes("partial") ? <p className="mt-2 text-caption text-muted">{COPY.mediaPartial}</p> : null}
    </SaveDialogShell>
  );
}
