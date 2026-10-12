import { Link, useParams } from "@tanstack/react-router";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";

import { ExamHubView } from "@/components/exam-hub";

import { HubSkeleton } from "@/components/skeleton";

import { Button, EmptyState } from "@/components/ui/kit";

import { writeExamId } from "@inkboard/shared/exam-pref";

import { getExam } from "@inkboard/shared/exams";

import { readHub, rememberHub } from "@inkboard/shared/catalog-cache";

import { COPY } from "@inkboard/shared/copy";

import { loadExamHub, loadExamTeachers, loadExamCourses, type ExamHub, type ExamTeacher, type ExamCourse } from "@/lib/unacademy";

export default function ExamPage() {
  const { goalId } = useParams({ from: "/exam/$goalId" });
  const exam = getExam(goalId);
  const [extra, setExtra] = useState<ExamTeacher[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraCourses, setExtraCourses] = useState<ExamCourse[]>([]);
  const [coursesNext, setCoursesNext] = useState<number | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);

  useEffect(() => {
    setExtra([]);
    setNextOffset(null);
    setExtraCourses([]);
    setCoursesNext(null);
    if (exam) writeExamId(exam.id);
  }, [exam, goalId]);

  const cached = exam ? readHub<ExamHub>(exam.id) : undefined;

  const q = useQuery({
    queryKey: ["exam-hub", "v8", exam?.id],
    enabled: Boolean(exam),
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const page = await loadExamHub({ data: { goalId: exam!.id } });
      setExtra([]);
      setNextOffset(page.nextOffset);
      setExtraCourses([]);
      setCoursesNext(page.coursesNext);
      if (!rememberHub(exam!.id, page)) throw new Error(COPY.wallDidNotLoad);
      return page;
    },
  });

  const loadMore = useCallback(async () => {
    const offset = extra.length === 0 ? (q.data?.nextOffset ?? nextOffset) : nextOffset;
    if (offset == null || loadingMore || !exam) return;
    setLoadingMore(true);
    try {
      const page = await loadExamTeachers({ data: { goalId: exam.id, offset } });
      setExtra((prev) => [...prev, ...page.teachers]);
      setNextOffset(page.nextOffset);
    } finally {
      setLoadingMore(false);
    }
  }, [extra.length, q.data?.nextOffset, nextOffset, loadingMore, exam]);

  const loadMoreCourses = useCallback(async () => {
    const offset = extraCourses.length === 0 ? (q.data?.coursesNext ?? coursesNext) : coursesNext;
    if (offset == null || loadingCourses || !exam) return;
    setLoadingCourses(true);
    try {
      const page = await loadExamCourses({ data: { goalId: exam.id, offset } });
      setExtraCourses((prev) => [...prev, ...page.courses]);
      setCoursesNext(page.nextOffset);
    } finally {
      setLoadingCourses(false);
    }
  }, [extraCourses.length, q.data?.coursesNext, coursesNext, loadingCourses, exam]);

  if (!exam) {
    return (
      <AppShell>
        <div className="board-pad">
          <EmptyState
            title={COPY.examNotOnWall}
            action={
              <Link to="/" className="btn is-quiet">
                {COPY.backToTheWall}
              </Link>
            }
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="board-pad">
        {q.isLoading && !q.data ? (
          <HubSkeleton />
        ) : q.isError || !q.data ? (
          <EmptyState
            title={COPY.wallDidNotLoad}
            body={q.error instanceof Error ? q.error.message : COPY.wallDidNotAnswer}
            action={
              <Button type="button" onClick={() => void q.refetch()}>
                {COPY.tryAgain}
              </Button>
            }
          />
        ) : (
          <ExamHubView
            hub={q.data}
            extraTeachers={extra}
            extraCourses={extraCourses}
            loadingMore={loadingMore}
            loadingCourses={loadingCourses}
            onLoadMore={
              (extra.length === 0 ? (q.data.nextOffset ?? nextOffset) : nextOffset) != null
                ? () => void loadMore()
                : undefined
            }
            onLoadMoreCourses={
              (extraCourses.length === 0 ? (q.data.coursesNext ?? coursesNext) : coursesNext) != null
                ? () => void loadMoreCourses()
                : undefined
            }
          />
        )}
      </div>
      <p className="board-pad pt-0 pb-16">
        <Link to="/" onClick={() => writeExamId("")} className="text-sm text-muted hover:text-primary">
          {COPY.backToTheWall}
        </Link>
      </p>
    </AppShell>
  );
}
