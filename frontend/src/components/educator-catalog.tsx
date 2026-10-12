import { catalogRowClass } from "@/components/catalog-row";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InfiniteTrigger } from "@/components/infinite-trigger";
import { IndexShelf } from "@/components/folio/wall";
import {
  Brief,
  MuteWord,
  IndexLine,
  LargeStamp,
  LineSkel,
  ShelfEmpty,
  useShelfLedger,
  WriteField,
} from "@/components/folio/shelf";
import { courseOnTopic, coursePrimaryTopic, isGenericTopic, topicsTaught } from "@inkboard/shared/exam-wall";
import { useSelectedExam } from "@inkboard/shared/exam-pref";
import { examMatchesGoal } from "@inkboard/shared/exams";
import { isSaved, toggleSaved } from "@inkboard/shared/library";
import { localGet, localSet } from "@inkboard/shared/local-cache";
import { teacherShelfEmpty, type TeacherTab } from "@inkboard/shared/shelf";
import {
  loadCourseDetail,
  loadEducatorBatches,
  loadEducatorPage,
  loadEducatorSpecials,
  type EducatorPage,
  type SpecialCourse,
  type UaBatch,
  type UaCourse,
} from "@/lib/unacademy";
import { COPY } from "@inkboard/shared/copy";

export type { TeacherTab };

function fmtDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function EducatorCatalog({
  username,
  topicUid,
  sort = "latest",
  tab = "courses",
  onTopic,
  onSort,
  onTab,
  exam: examProp,
}: {
  username: string;
  topicUid?: string;
  sort?: "latest" | "popular";
  tab?: TeacherTab;
  onTopic?: (uid?: string) => void;
  onSort?: (sort: "latest" | "popular") => void;
  onTab?: (tab: TeacherTab) => void;
  backTo?: string;
  backLabel?: string;
  exam?: { id: string; name: string } | null;
}) {
  const selectedExam = useSelectedExam();
  const exam = examProp ?? selectedExam;
  const [extra, setExtra] = useState<UaCourse[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allTopics, setAllTopics] = useState(false);
  const [extraBatches, setExtraBatches] = useState<UaBatch[]>([]);
  const [batchOffset, setBatchOffset] = useState<number | null>(null);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [extraSpecials, setExtraSpecials] = useState<SpecialCourse[]>([]);
  const [specialOffset, setSpecialOffset] = useState<number | null>(null);
  const [loadingSpecials, setLoadingSpecials] = useState(false);
  const [courseFilter, setCourseFilter] = useState("");

  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(isSaved(username));
  }, [username]);

  useEffect(() => {
    setExtra([]);
    setNextOffset(null);
    setCourseFilter("");
  }, [username, sort]);

  useEffect(() => {
    setExtraBatches([]);
    setBatchOffset(null);
    setExtraSpecials([]);
    setSpecialOffset(null);
  }, [username]);
  const cacheKey = `edu3:${username.toLowerCase()}:${sort}`;
  const cached = localGet<EducatorPage>(cacheKey);

  const q = useQuery({
    queryKey: ["educator", "v3", username.toLowerCase(), sort],
    placeholderData: keepPreviousData,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.at,
    queryFn: async () => {
      const page = await loadEducatorPage({ data: { username, sort, offset: 0 } });
      setExtra([]);
      setNextOffset(page.nextOffset);
      localSet(cacheKey, page);
      return page;
    },
  });

  const batchesQ = useQuery({
    queryKey: ["educator-batches", username.toLowerCase()],
    queryFn: async () => {
      const page = await loadEducatorBatches({ data: { username, offset: 0 } });
      setExtraBatches([]);
      setBatchOffset(page.nextOffset);
      return page;
    },
    enabled: tab === "batches" || Boolean(q.data),
  });

  const specialsQ = useQuery({
    queryKey: ["educator-specials", username.toLowerCase()],
    queryFn: async () => {
      const page = await loadEducatorSpecials({ data: { username, offset: 0 } });
      setExtraSpecials([]);
      setSpecialOffset(page.nextOffset);
      return page;
    },
    enabled: tab === "free" || Boolean(q.data),
  });

  const courses = useMemo(() => [...(q.data?.courses ?? []), ...extra], [q.data?.courses, extra]);
  const batches = useMemo(
    () => [...(batchesQ.data?.batches ?? []), ...extraBatches],
    [batchesQ.data?.batches, extraBatches],
  );
  const specials = useMemo(
    () => [...(specialsQ.data?.courses ?? []), ...extraSpecials],
    [specialsQ.data?.courses, extraSpecials],
  );
  const batchesNext = extraBatches.length > 0 ? batchOffset : (batchesQ.data?.nextOffset ?? batchOffset);
  const specialsNext = extraSpecials.length > 0 ? specialOffset : (specialsQ.data?.nextOffset ?? specialOffset);
  const topics = useMemo(() => topicsTaught(courses), [courses]);
  const covered = topics.filter((t) => !isGenericTopic(t.name));
  const shownTopics = allTopics || covered.length <= 16 ? covered : covered.slice(0, 16);
  const activeTopic = topicUid ? topics.find((t) => t.uid === topicUid) : undefined;
  const needle = courseFilter.trim().toLowerCase();
  const visible = (activeTopic
    ? courses.filter((c) => courseOnTopic(c, activeTopic))
    : courses
  ).filter((c) => !needle || c.name.toLowerCase().includes(needle));

  const loadMore = useCallback(async () => {
    const offset = extra.length === 0 ? (q.data?.nextOffset ?? nextOffset) : nextOffset;
    if (offset == null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadEducatorPage({ data: { username, sort, offset } });
      setExtra((prev) => [...prev, ...page.courses]);
      setNextOffset(page.nextOffset);
    } finally {
      setLoadingMore(false);
    }
  }, [extra.length, q.data?.nextOffset, nextOffset, loadingMore, username, sort]);

  const loadMoreBatches = useCallback(async () => {
    const offset = extraBatches.length > 0 ? batchOffset : (batchesQ.data?.nextOffset ?? batchOffset);
    if (offset == null || loadingBatches) return;
    setLoadingBatches(true);
    try {
      const page = await loadEducatorBatches({ data: { username, offset } });
      setExtraBatches((prev) => [...prev, ...page.batches]);
      setBatchOffset(page.nextOffset);
    } finally {
      setLoadingBatches(false);
    }
  }, [batchOffset, extraBatches.length, batchesQ.data?.nextOffset, loadingBatches, username]);

  const loadMoreSpecials = useCallback(async () => {
    const offset = extraSpecials.length > 0 ? specialOffset : (specialsQ.data?.nextOffset ?? specialOffset);
    if (offset == null || loadingSpecials) return;
    setLoadingSpecials(true);
    try {
      const page = await loadEducatorSpecials({ data: { username, offset } });
      setExtraSpecials((prev) => [...prev, ...page.courses]);
      setSpecialOffset(page.nextOffset);
    } finally {
      setLoadingSpecials(false);
    }
  }, [specialOffset, extraSpecials.length, specialsQ.data?.nextOffset, loadingSpecials, username]);

  useShelfLedger(
    q.data
      ? {
          kicker: "Teacher",
          title: q.data.educator.name,
          meta: `@${q.data.educator.username}`,
          teacher: q.data.educator.username,
          examId: exam?.id,
        }
      : null,
  );

  if (q.isLoading) {
    return (
      <main className="board-pad">
        <p className="text-seal text-faint">Looking up @{username}</p>
        <LineSkel />
      </main>
    );
  }

  if (q.isError || !q.data) {
    return (
      <main className="board-pad">
        <ShelfEmpty
          title={COPY.stampDidNotLoad}
          body={q.error instanceof Error ? q.error.message : COPY.usernameNotOnWall}
          action={
            <Link to="/" className="ink-underline text-sm text-muted">
              {COPY.backToTheWall}
            </Link>
          }
        />
      </main>
    );
  }

  const ed = q.data.educator;
  const examBatches = exam ? batches.filter((b) => examMatchesGoal(exam, b.goalUid)) : [];
  const otherBatches = exam ? batches.filter((b) => !examMatchesGoal(exam, b.goalUid)) : batches;
  const batchTotal = batchesQ.data?.total ?? 0;
  const tabs: { id: TeacherTab; label: string }[] = [
    { id: "batches", label: "Batches" },
    { id: "courses", label: "Courses" },
    { id: "free", label: "Free" },
  ];
  const empty = teacherShelfEmpty(tab, { filter: courseFilter, hasBatches: batchTotal > 0 });

  return (
    <main className="board-pad">
      {exam ? (
        <Link to="/exam/$goalId" params={{ goalId: exam.id }} className="ink-underline text-sm text-muted">
          ← {exam.name}
        </Link>
      ) : (
        <Link to="/" className="ink-underline text-sm text-muted">
          ← All exams
        </Link>
      )}

      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
        <LargeStamp src={ed.avatar} name={ed.name} />
        <div className="min-w-0">
          <p className="text-sm text-muted">@{ed.username}</p>
          <h1 className="mt-1 text-2xl font-medium">{ed.name}</h1>
          {(() => {
            const meta = [
              ed.courseCount ? `${ed.courseCount} courses` : "",
              batchTotal ? `${batchTotal} batches` : "",
              ed.languages.slice(0, 3).join(" · "),
            ]
              .filter(Boolean)
              .join(" · ");
            return meta ? <p className="mt-2 text-sm text-muted">{meta}</p> : null;
          })()}
          {ed.bio ? <Brief text={ed.bio} /> : null}
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <button
              type="button"
              onClick={() => {
                const on = toggleSaved({ username: ed.username, name: ed.name, avatar: ed.avatar });
                setSaved(on);
              }}
              className="ink-underline text-muted"
            >
              {saved ? "Saved" : "Save teacher"}
            </button>
            <Link
              to="/planner/new"
              search={{ exam: exam?.id, teacher: ed.username }}
              className="ink-underline text-muted"
            >
              Add to plan
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1">
        {tabs.map((t) => (
          <MuteWord key={t.id} label={t.label} selected={tab === t.id} onSelect={() => onTab?.(t.id)} />
        ))}
      </div>

      {tab === "courses" ? (
        <>
          {covered.length > 0 ? (
            <section className="mt-8">
              <p className="text-seal mb-2 text-faint">Topics</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {shownTopics.map((t) => (
                  <MuteWord
                    key={t.uid}
                    label={t.name}
                    selected={t.uid === topicUid}
                    onSelect={() => onTopic?.(t.uid === topicUid ? undefined : t.uid)}
                  />
                ))}
                {covered.length > 16 ? (
                  <MuteWord
                    label={allTopics ? "Fewer" : `+${covered.length - 16} more`}
                    selected={allTopics}
                    onSelect={() => setAllTopics((v) => !v)}
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="mt-8">
            <WriteField
              value={courseFilter}
              onChange={setCourseFilter}
              label="Write a course"
              placeholder="Write a course"
            />
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
              {(["popular", "latest"] as const).map((s) => (
                <MuteWord
                  key={s}
                  label={s === "latest" ? "Latest" : "Popular"}
                  selected={sort === s}
                  onSelect={() => onSort?.(s)}
                />
              ))}
            </div>
            <p className="mt-4 text-caption text-muted">
              {activeTopic
                ? `${visible.length} on ${activeTopic.name}`
                : `${q.data.totalCourses} courses · showing ${visible.length}`}
            </p>
            <IndexShelf>
              {visible.map((c) => (
                <CourseLine key={c.uid} course={c} username={ed.username} />
              ))}
            </IndexShelf>
            {visible.length === 0 ? <ShelfEmpty title={empty.title} body={empty.body} /> : null}
            {!activeTopic && (extra.length === 0 ? q.data.nextOffset : nextOffset) != null ? (
              <InfiniteTrigger onVisible={() => void loadMore()} disabled={loadingMore} label="More courses" />
            ) : null}
          </section>
        </>
      ) : null}

      {tab === "batches" ? (
        <section className="mt-8">
          <p className="text-sm text-muted">
            {exam
              ? examBatches.length
                ? `${exam.name} batches first, then anything else they teach.`
                : `No ${exam.name} batch on this page — other exams they teach are below.`
              : "Year-long batches — open one for the live timetable."}
          </p>
          {batchesQ.isLoading ? (
            <LineSkel n={6} />
          ) : (
            <>
              {exam && examBatches.length ? (
                <div className="mt-6">
                  <p className="text-seal mb-2 text-faint">{exam.name}</p>
                  <IndexShelf>
                    {examBatches.map((b) => (
                      <BatchLine key={b.uid} batch={b} />
                    ))}
                  </IndexShelf>
                </div>
              ) : null}
              {otherBatches.length ? (
                <div className="mt-6">
                  {exam && examBatches.length ? (
                    <p className="text-seal mb-2 text-faint">Other exams</p>
                  ) : null}
                  <IndexShelf>
                    {otherBatches.map((b) => (
                      <BatchLine key={b.uid} batch={b} />
                    ))}
                  </IndexShelf>
                </div>
              ) : null}
            </>
          )}
          {batchesQ.data && batches.length === 0 ? <ShelfEmpty title={empty.title} body={empty.body} /> : null}
          {batchesNext != null ? (
            <InfiniteTrigger onVisible={() => void loadMoreBatches()} disabled={loadingBatches} label="More batches" />
          ) : null}
        </section>
      ) : null}

      {tab === "free" ? (
        <section className="mt-8">
          {specialsQ.isLoading ? (
            <LineSkel n={6} />
          ) : (
            <IndexShelf>
              {specials.map((c) => (
                <SpecialLine key={c.uid} course={c} username={ed.username} />
              ))}
            </IndexShelf>
          )}
          {specialsQ.data && specials.length === 0 ? <ShelfEmpty title={empty.title} body={empty.body} /> : null}
          {specialsNext != null ? (
            <InfiniteTrigger
              onVisible={() => void loadMoreSpecials()}
              disabled={loadingSpecials}
              label="More classes"
            />
          ) : null}
        </section>
      ) : null}
    </main>
  );
}

function CourseLine({ course, username }: { course: UaCourse; username: string }) {
  const qc = useQueryClient();
  const primary = coursePrimaryTopic(course.topics, course.name);
  const kicker = primary?.name || course.language || "Course";
  const meta = [
    course.itemCount ? `${course.itemCount} ${course.itemCount === 1 ? "class" : "classes"}` : "",
    course.language,
    course.startsAt ? fmtDate(course.startsAt) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      to="/course/$courseId"
      params={{ courseId: course.uid }}
      search={{ slug: course.slug, teacher: username }}
      onMouseEnter={() => {
        void qc.prefetchQuery({
          queryKey: ["course", "v8", course.uid],
          queryFn: () => loadCourseDetail({ data: { uid: course.uid, slug: course.slug } }),
        });
      }}
      className={catalogRowClass}
    >
      <IndexLine kicker={kicker} title={course.name} meta={meta} />
    </Link>
  );
}

function BatchLine({ batch }: { batch: UaBatch }) {
  const meta = [
    batch.syllabusTag,
    batch.startsAt ? fmtDate(batch.startsAt) : "",
    batch.authors
      .slice(0, 3)
      .map((a) => a.name)
      .join(" · "),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link to="/batch/$batchId" params={{ batchId: batch.uid }} search={{ slug: batch.slug }} className={catalogRowClass}>
      <IndexLine kicker={batch.goalName || "Batch"} title={batch.name} meta={meta} />
    </Link>
  );
}

function SpecialLine({ course, username }: { course: SpecialCourse; username: string }) {
  const live = course.status === "live";
  const kicker = live ? "Live" : course.status === "upcoming" ? "Upcoming" : "Free";
  const inner = (
    <IndexLine kicker={kicker} title={course.name} meta={course.liveAt ? fmtDate(course.liveAt) : course.language} />
  );
  if (course.replayId && !live) {
    return (
      <Link
        to="/play/$lessonId"
        params={{ lessonId: course.replayId }}
        search={{ title: course.name, teacher: username, course: course.uid }}
        className={catalogRowClass}
      >
        {inner}
      </Link>
    );
  }
  if (course.classUid) {
    return (
      <Link
        to="/live/$classId"
        params={{ classId: course.classUid }}
        search={{ slug: course.classSlug || course.slug, course: course.uid }}
        className={catalogRowClass}
      >
        {inner}
      </Link>
    );
  }
  return (
    <Link
      to="/course/$courseId"
      params={{ courseId: course.uid }}
      search={{ slug: course.slug, teacher: username }}
      className={catalogRowClass}
    >
      {inner}
    </Link>
  );
}
