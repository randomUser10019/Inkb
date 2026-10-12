import { Link, useParams, useSearch } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { lazy, Suspense } from "react";

import { ArchivedLesson } from "@/components/archived-lesson";

import { AppShell } from "@/components/app-shell";

import { StatusPanel } from "@/components/skeleton";

import { getTeacher, lessonByUnacademyId } from "@inkboard/shared/catalog";

import { AppErrorComponent, PlayerErrorBoundary } from "@/lib/error-component";

import { isArchivedLessonError, loadLessonTimeline } from "@/lib/lesson-api";

import { pendingTimeline } from "@inkboard/shared/dcn";

import { COPY } from "@inkboard/shared/copy";

const ClassPlayer = lazy(() => import("@/components/class-player").then((m) => ({ default: m.ClassPlayer })));

export default function PlayPage() {
  const { lessonId } = useParams({ from: "/play/$lessonId" });
  const search = useSearch({ from: "/play/$lessonId" });
  const catalog = lessonByUnacademyId(lessonId);
  const teacher = getTeacher(search.teacher ?? catalog?.teacherSlug ?? "");
  const title = search.title ?? catalog?.title ?? "Live class";
  const educatorName = teacher?.name ?? search.teacher;

  const q = useQuery({
    queryKey: ["lesson", "v2", lessonId],
    queryFn: () => loadLessonTimeline({ data: { id: lessonId } }),
    retry: (count, err) => count < 1 && !isArchivedLessonError(err),
  });

  const back = search.course
    ? `/course/${search.course}`
    : teacher
      ? `/teacher/${teacher.slug}`
      : "/";

  if (q.isLoading && !q.data) {
    return (
      <PlayerErrorBoundary>
      <Suspense fallback={<StatusPanel title="Opening class" />}>
        <ClassPlayer
          key={lessonId}
          timeline={pendingTimeline(lessonId, title)}
          title={title}
          educator={educatorName}
          teacherSlug={search.teacher ?? teacher?.slug}
          courseId={search.course}
          fromCourse={search.fromCourse}
          backTo={back}
          notesUrl={search.notes}
          startAt={search.t}
          focus={Boolean(search.focus)}
        />
      </Suspense>
      </PlayerErrorBoundary>
    );
  }

  if (q.isError || !q.data) {
    if (isArchivedLessonError(q.error)) {
      return (
        <ArchivedLesson
          lessonId={lessonId}
          title={title}
          educator={educatorName}
          backTo={back}
          notesUrl={search.notes}
        />
      );
    }
    return (
      <AppShell>
        <main className="grid min-h-[70dvh] place-items-center px-4 py-16">
          <StatusPanel
            tone="error"
            title={COPY.classDidNotOpen}
            body={q.error instanceof Error ? q.error.message : COPY.slateSlipped}
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link to="/" className="ink-underline text-sm text-muted">
                  {COPY.backToTheWall}
                </Link>
                <button type="button" onClick={() => void q.refetch()} className="text-sm text-muted hover:text-fg">
                  {COPY.tryAgain}
                </button>
              </div>
            }
          />
        </main>
      </AppShell>
    );
  }

  return (
    <PlayerErrorBoundary>
      <Suspense fallback={<StatusPanel title="Opening class" />}>
      <ClassPlayer
        key={lessonId}
        timeline={{ ...q.data, title }}
        title={title}
        educator={educatorName}
        teacherSlug={search.teacher ?? teacher?.slug}
        courseId={search.course}
        fromCourse={search.fromCourse}
        backTo={back}
        notesUrl={search.notes}
        startAt={search.t}
        focus={Boolean(search.focus)}
      />
      </Suspense>
    </PlayerErrorBoundary>
  );
}
