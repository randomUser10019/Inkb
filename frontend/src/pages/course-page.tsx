import { Link, useParams, useSearch } from "@tanstack/react-router";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";

import { LessonResources } from "@/components/lesson-resources";

import { NotesButton } from "@/components/notes-button";

import { NotesLocker } from "@/components/notes-locker";

import { ChalkLead, ChalkRow, Brief, LineSkel, ShelfEmpty, useShelfLedger, WriteField } from "@/components/folio/shelf";

import { LaterButton } from "@/components/watch-later";

import { getCourse, getTeacher, lessonsForCourse } from "@inkboard/shared/catalog";

import { rememberCourse } from "@inkboard/shared/catalog-cache";

import { AppErrorComponent } from "@/lib/error-component";

import { localGet } from "@inkboard/shared/local-cache";

import { loadLessonTimeline, probeReplayMedia } from "@/lib/lesson-api";

import { notesHref } from "@inkboard/shared/notes";

import { COPY } from "@inkboard/shared/copy";

import { collectNotesFiles, notesFileCounts } from "@inkboard/shared/notes-zip";

import {
  altReplayFootnote,
  coverageRatio,
  fmtDur,
  lessonStatusCaption,
  lineState,
  nextOpenIndex,
  parseClock,
  shelfCoverageCopy,
} from "@inkboard/shared/shelf";

import { courseSeal } from "@inkboard/shared/exam-wall";

import { loadCourseDetail, loadCourseLessons, type UaLesson } from "@/lib/unacademy";

import { SaveChapterButton, SaveClassButton, SaveCourseButton } from "@/components/save-chapter";

import { peekProgress } from "@inkboard/shared/watch-history";

import { readWatchLogs } from "@inkboard/shared/planner/watch-store";

function fmtWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function groupLessons(lessons: UaLesson[]) {
  if (!lessons.some((l) => l.week != null)) return [{ week: null as number | null, lessons }];
  const map = new Map<number, UaLesson[]>();
  const rest: UaLesson[] = [];
  for (const lesson of lessons) {
    if (lesson.week == null) rest.push(lesson);
    else {
      const list = map.get(lesson.week) ?? [];
      list.push(lesson);
      map.set(lesson.week, list);
    }
  }
  const groups = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([week, rows]) => ({ week: week as number | null, lessons: rows }));
  if (rest.length) groups.push({ week: null, lessons: rest });
  return groups;
}

function mergeUid(prev: UaLesson[], next: UaLesson[]) {
  const map = new Map(prev.map((l) => [l.uid, l]));
  for (const l of next) {
    const old = map.get(l.uid);
    map.set(
      l.uid,
      old
        ? {
            ...old,
            ...l,
            replayId: l.replayId || old.replayId,
            altReplay: Boolean((l.replayId || old.replayId) && (l.altReplay || old.altReplay)),
            fromCourse: l.fromCourse || old.fromCourse,
          }
        : l,
    );
  }
  return [...map.values()].sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title));
}

export default function CoursePage() {
  const { courseId } = useParams({ from: "/course/$courseId" });
  const search = useSearch({ from: "/course/$courseId" });
  const qc = useQueryClient();
  const catalogCourse = getCourse(courseId);
  const catalogTeacher = catalogCourse ? getTeacher(catalogCourse.teacherSlug) : undefined;
  const catalogLessons = catalogCourse ? lessonsForCourse(courseId) : [];
  const liveId = /^[A-Za-z0-9]{4,16}$/.test(courseId);
  const [extra, setExtra] = useState<UaLesson[]>([]);
  const [q, setQ] = useState("");
  const cacheKey = `course-v10:${courseId}:${search.slug ?? ""}:${search.teacher ?? ""}`;
  const cached = liveId ? localGet<Awaited<ReturnType<typeof loadCourseDetail>>>(cacheKey) : undefined;
  const live = useQuery({
    queryKey: ["course", "v10", courseId, search.slug, search.teacher],
    enabled: liveId,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
    staleTime: 60_000,
    queryFn: async () => {
      const page = await loadCourseDetail({ data: { uid: courseId, slug: search.slug, teacher: search.teacher } });
      rememberCourse(courseId, search.slug, search.teacher, page);
      return page;
    },
  });
  const rawLessons = useMemo(() => mergeUid(live.data?.lessons ?? [], extra), [live.data?.lessons, extra]);
  const replayIds = useMemo(() => rawLessons.map((l) => l.replayId).filter((id): id is string => Boolean(id)), [rawLessons]);
  const media = useQuery({
    queryKey: ["replay-media", courseId, replayIds.join(",")],
    enabled: replayIds.length > 0,
    staleTime: 21_600_000,
    queryFn: () => probeReplayMedia({ data: { ids: replayIds } }),
  });
  const lessons = useMemo(() => {
    const hits = media.data;
    if (!hits) return rawLessons;
    return rawLessons.map((lesson) => {
      if (!lesson.replayId) return lesson;
      if (!hits[lesson.replayId]?.archived) return lesson;
      return { ...lesson, status: "archived" as const };
    });
  }, [rawLessons, media.data]);

  useEffect(() => {
    setExtra([]);
  }, [courseId, live.data?.nextOffset]);

  useEffect(() => {
    if (live.data) window.dispatchEvent(new Event("inkboard-catalog-ok"));
  }, [live.data]);

  useEffect(() => {
    if (!live.data?.nextOffset) return;
    let cancelled = false;
    loadCourseLessons({
      data: { uid: courseId, offset: live.data.nextOffset, total: live.data.total, slug: search.slug || live.data.course.slug },
    }).then((page) => {
      if (!cancelled) setExtra(page.lessons);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [courseId, live.data?.nextOffset, live.data?.total, live.data?.course.slug, search.slug]);

  if (!liveId && catalogCourse && catalogTeacher) {
    return <CatalogShelf courseId={courseId} />;
  }

  if (live.isLoading) {
    return (
      <AppShell>
        <main className="board-pad">
          <LineSkel />
        </main>
      </AppShell>
    );
  }

  if (!live.data) {
    return (
      <AppShell>
        <main className="board-pad">
          <ShelfEmpty
            title={COPY.shelfDidNotLoad}
            body={`${live.error instanceof Error ? live.error.message : COPY.shelfDidNotLoad} Some lists are not courses — open the teacher, or pick a course from the exam.`}
            action={
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <button type="button" onClick={() => void live.refetch()} className="h-11 text-primary">
                  {COPY.tryAgain}
                </button>
                {search.teacher ? (
                  <Link to="/teacher/$slug" params={{ slug: search.teacher }} className="ink-underline text-muted">
                    @{search.teacher}
                  </Link>
                ) : null}
                <Link to="/" className="ink-underline text-muted">
                  {COPY.backToTheWall}
                </Link>
              </div>
            }
          />
        </main>
      </AppShell>
    );
  }

  const { course } = live.data;
  const teacher = course.authorUsername || search.teacher;
  const liveCount = lessons.filter((l) => l.status === "live").length;
  const upcomingCount = lessons.filter((l) => l.status === "upcoming").length;
  const archivedCount = lessons.filter((l) => l.status === "archived").length;
  const needle = q.trim().toLowerCase();
  const filtered = lessons.filter((lesson) => {
    if (needle && !lesson.title.toLowerCase().includes(needle)) return false;
    return true;
  });
  const groups = groupLessons(filtered);
  const stillLoading = live.data.nextOffset != null && extra.length === 0;
  const logs = typeof window === "undefined" ? [] : readWatchLogs();
  const states = filtered.map((lesson) =>
    lineState({
      watchedSec: lesson.replayId ? peekProgress(lesson.replayId) : 0,
      durationSec: lesson.durationSec,
      coverage: lesson.replayId ? coverageRatio(logs, lesson.replayId, lesson.durationSec) : 0,
    }),
  );
  const nextIdx = nextOpenIndex(states.map((s, i) => (filtered[i]?.playable || filtered[i]?.status === "live" ? s : "struck")));
  const nextLesson = nextIdx >= 0 ? filtered[nextIdx] : undefined;
  const notesFiles = collectNotesFiles(lessons);
  const notesCounts = notesFileCounts(notesFiles);
  const topic = courseSeal(course.topics, course.language, course.name);
  const footnote = [
    altReplayFootnote(lessons),
    archivedCount ? `${archivedCount} archived` : "",
    course.language || "",
  ]
    .filter(Boolean)
    .join(" · ");

  void catalogLessons;

  return (
    <LiveShelf
      courseName={course.name}
      topic={topic}
      teacher={teacher}
      teacherName={course.authorName}
      courseId={course.uid}
      total={live.data.total || lessons.length}
      liveCount={liveCount}
      upcomingCount={upcomingCount}
      footnote={footnote}
      description={course.description}
      stillLoading={stillLoading}
      lessons={lessons}
      notesCount={notesCounts.known}
      notesGuessed={notesCounts.guessed}
      nextTitle={nextLesson?.title}
      q={q}
      setQ={setQ}
      groups={groups}
      filtered={filtered}
      states={states}
      nextIdx={nextIdx}
      prefetch={(id, archived) => {
        if (!id || archived) return;
        qc.prefetchQuery({ queryKey: ["lesson", "v2", id], queryFn: () => loadLessonTimeline({ data: { id } }) });
      }}
    />
  );
}

function CatalogShelf({ courseId }: { courseId: string }) {
  const catalogCourse = getCourse(courseId)!;
  const catalogTeacher = getTeacher(catalogCourse.teacherSlug)!;
  const catalogLessons = lessonsForCourse(courseId);
  const logs = typeof window === "undefined" ? [] : readWatchLogs();
  const states = catalogLessons.map((lesson) => {
    const dur = parseClock(lesson.duration);
    return lineState({
      watchedSec: lesson.lessonId ? peekProgress(lesson.lessonId) : 0,
      durationSec: dur,
      coverage: lesson.lessonId ? coverageRatio(logs, lesson.lessonId, dur) : 0,
    });
  });
  const nextIdx = nextOpenIndex(states);
  useShelfLedger({
    kicker: "Course",
    title: catalogCourse.title,
    meta: `${catalogCourse.lessons} classes · ${catalogCourse.hours}`,
    teacher: catalogTeacher.slug,
    course: catalogCourse.id,
    next: nextIdx >= 0 ? catalogLessons[nextIdx]?.title : undefined,
  });

  return (
    <AppShell>
      <main className="board-pad">
        <Link to="/teacher/$slug" params={{ slug: catalogTeacher.slug }} className="ink-underline text-sm text-muted">
          ← {catalogTeacher.name}
        </Link>
        <p className="mt-4 text-sm text-muted">{catalogCourse.subject}</p>
        <h1 className="mt-1 text-2xl font-medium">{catalogCourse.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {catalogTeacher.name} · {catalogCourse.lessons} classes · {catalogCourse.hours}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4">
          <SaveCourseButton
            courseId={catalogCourse.id}
            courseTitle={catalogCourse.title}
            groups={[{ week: null, lessons: catalogLessons.map((lesson) => ({
              replayId: lesson.lessonId,
              title: lesson.title,
              durationSec: parseClock(lesson.duration),
              playable: Boolean(lesson.lessonId) && !lesson.live,
              status: lesson.live ? "live" : lesson.lessonId ? "replay" : "upcoming",
            })) }]}
          />
          <SaveChapterButton
            courseId={catalogCourse.id}
            courseTitle={catalogCourse.title}
            chapterId={`${catalogCourse.id}-all`}
            chapterTitle={catalogCourse.title}
            lessons={catalogLessons.map((lesson) => ({
              replayId: lesson.lessonId,
              title: lesson.title,
              durationSec: parseClock(lesson.duration),
              playable: Boolean(lesson.lessonId) && !lesson.live,
              status: lesson.live ? "live" : lesson.lessonId ? "replay" : "upcoming",
            }))}
          />
        </div>
        <ol className="mt-8">
          {catalogLessons.map((lesson, i) => {
            const struck = states[i] === "struck";
            const next = i === nextIdx;
            const watchedSec = lesson.lessonId ? peekProgress(lesson.lessonId) : 0;
            const dur = parseClock(lesson.duration);
            const progress = dur > 0 ? (watchedSec / dur) * 100 : 0;
            return (
              <ChalkRow key={lesson.id} struck={struck} next={next} actions={
                <>
                  {lesson.lessonId ? <SaveClassButton lessonId={lesson.lessonId} title={lesson.title} variant="line" /> : null}
                  {lesson.lessonId ? <NotesButton href={notesHref({ id: lesson.lessonId, title: lesson.title })} /> : null}
                </>
              }>
                <Link
                  to="/play/$lessonId"
                  params={{ lessonId: lesson.lessonId ?? "unknown" }}
                  search={{ title: lesson.title, teacher: catalogTeacher.slug, course: catalogCourse.id }}
                  className="chalk-line"
                >
                  <ChalkLead
                    n={i + 1}
                    title={lesson.title}
                    meta={[lesson.duration, lesson.lessonId ? "Notes" : ""].filter(Boolean).join(" · ")}
                    struck={struck}
                    next={next}
                    progress={progress}
                  />
                </Link>
              </ChalkRow>
            );
          })}
        </ol>
      </main>
    </AppShell>
  );
}

function LiveShelf({
  courseName,
  topic,
  teacher,
  teacherName,
  courseId,
  total,
  liveCount,
  upcomingCount,
  footnote,
  description,
  stillLoading,
  lessons,
  notesCount,
  notesGuessed,
  nextTitle,
  q,
  setQ,
  groups,
  filtered,
  states,
  nextIdx,
  prefetch,
}: {
  courseName: string;
  topic: string;
  teacher?: string;
  teacherName?: string;
  courseId: string;
  total: number;
  liveCount: number;
  upcomingCount: number;
  footnote: string;
  description?: string;
  stillLoading: boolean;
  lessons: UaLesson[];
  notesCount: number;
  notesGuessed?: number;
  nextTitle?: string;
  q: string;
  setQ: (v: string) => void;
  groups: { week: number | null; lessons: UaLesson[] }[];
  filtered: UaLesson[];
  states: ReturnType<typeof lineState>[];
  nextIdx: number;
  prefetch: (id: string, archived: boolean) => void;
}) {
  const struck = states.filter((s) => s === "struck").length;
  useShelfLedger({
    kicker: "Course",
    title: courseName,
    meta: `${total} classes`,
    teacher,
    course: courseId,
    next: nextTitle,
    notes: notesCount || undefined,
    notesGuessed: notesGuessed || undefined,
    coverage: shelfCoverageCopy(struck, Math.max(filtered.length, 1)),
  });
  const mute = [
    liveCount ? `${liveCount} live` : "",
    upcomingCount ? `${upcomingCount} upcoming` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  let running = 0;

  return (
    <AppShell>
      <main className="board-pad">
        {teacher ? (
          <Link to="/teacher/$slug" params={{ slug: teacher }} className="ink-underline text-sm text-muted">
            ← {teacherName || teacher}
          </Link>
        ) : (
          <Link to="/" className="ink-underline text-sm text-muted">
            ← Wall
          </Link>
        )}
        <p className="mt-4 text-sm text-muted">{topic}</p>
        <h1 className="mt-1 text-2xl font-medium">{courseName}</h1>
        <p className="mt-2 text-sm text-muted">
          {total} classes
          {mute ? ` · ${mute}` : ""}
        </p>
        {footnote ? <p className="mt-1 text-caption text-faint">{footnote}</p> : null}
        {description ? <Brief text={description} /> : null}
        <div className="mt-4 flex flex-wrap items-center gap-x-4">
          <SaveCourseButton courseId={courseId} courseTitle={courseName} groups={groups} />
          <NotesLocker lessons={lessons} courseName={courseName} />
        </div>
        {stillLoading ? <LineSkel n={3} /> : null}

        <div className="mt-6">
          <WriteField value={q} onChange={setQ} label="Find a class" placeholder="Find a class" />
        </div>

        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.week ?? "all"}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                {group.week != null ? <p className="text-seal text-faint">WEEK {group.week}</p> : <span />}
                <SaveChapterButton
                  courseId={courseId}
                  courseTitle={courseName}
                  chapterId={group.week != null ? `${courseId}-week-${group.week}` : `${courseId}-all`}
                  chapterTitle={group.week != null ? `Week ${group.week}` : courseName}
                  lessons={group.lessons}
                />
              </div>
              <ol>
                {group.lessons.map((lesson) => {
                  const idx = running;
                  running += 1;
                  const state = states[idx];
                  const struckLine = state === "struck";
                  const next = idx === nextIdx;
                  const watched = lesson.replayId ? peekProgress(lesson.replayId) : 0;
                  const metaBits = [
                    state === "resume" ? "Resume" : "",
                    lessonStatusCaption(lesson.status, lesson.altReplay, lesson.durationSec, lesson.fromCourse),
                    lesson.playable && lesson.durationSec ? fmtDur(lesson.durationSec) : "",
                    lesson.liveAt ? fmtWhen(lesson.liveAt) : "",
                    lesson.notesUrl ? "Notes" : "",
                    watched > 8 && state === "resume" && lesson.durationSec
                      ? `${Math.min(99, Math.round((watched / lesson.durationSec) * 100))}%`
                      : "",
                  ].filter(Boolean);
                  const lead = (
                    <ChalkLead
                      n={lesson.rank || idx + 1}
                      title={lesson.title}
                      meta={metaBits.join(" · ")}
                      struck={struckLine}
                      next={next}
                      live={lesson.status === "live"}
                      progress={lesson.durationSec ? (watched / lesson.durationSec) * 100 : 0}
                    />
                  );
                  const actions = (
                    <>
                      {lesson.replayId ? (
                        <SaveClassButton lessonId={lesson.replayId} title={lesson.title} variant="line" />
                      ) : null}
                      {lesson.replayId ? (
                        <LaterButton lessonId={lesson.replayId} title={lesson.title} teacher={teacher} course={courseId} />
                      ) : null}
                      <LessonResources lesson={lesson} />
                    </>
                  );
                  if (lesson.status === "live") {
                    return (
                      <ChalkRow key={lesson.uid} struck={struckLine} next={next} actions={actions}>
                        <Link
                          to="/live/$classId"
                          params={{ classId: lesson.uid }}
                          search={{ slug: lesson.slug, course: courseId }}
                          className="chalk-line"
                        >
                          {lead}
                        </Link>
                      </ChalkRow>
                    );
                  }
                  if (lesson.playable && lesson.replayId) {
                    return (
                      <ChalkRow key={lesson.uid} struck={struckLine} next={next} actions={actions}>
                        <Link
                          to="/play/$lessonId"
                          params={{ lessonId: lesson.replayId }}
                          search={{
                            title: lesson.title,
                            teacher: teacher || "",
                            course: courseId,
                            fromCourse: lesson.fromCourse,
                          }}
                          onMouseEnter={() => prefetch(lesson.replayId!, lesson.status === "archived")}
                          className="chalk-line"
                        >
                          {lead}
                        </Link>
                      </ChalkRow>
                    );
                  }
                  return (
                    <ChalkRow key={lesson.uid} struck={struckLine} next={next} actions={actions}>
                      <div className="chalk-line is-off">{lead}</div>
                    </ChalkRow>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
        {filtered.length === 0 ? (
          <ShelfEmpty
            title={lessons.length === 0 ? "No classes on this course yet" : "No classes match that"}
            body={lessons.length === 0 ? "This course has no timetable yet." : "Clear the filter."}
          />
        ) : null}
      </main>
    </AppShell>
  );
}
