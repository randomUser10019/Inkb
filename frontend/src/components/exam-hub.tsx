import { catalogRowClass } from "@/components/catalog-row";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { InfiniteTrigger } from "@/components/infinite-trigger";
import { MuteWord } from "@/components/folio/shelf";
import {
  CourseIndex,
  CrashDoor,
  DoorRow,
  IndexShelf,
  LiveDoor,
  PlateGrid,
  PlaylistIndex,
  StampRack,
  SubjectPlate,
  TeacherStamp,
} from "@/components/folio/wall";
import { plannedCourseIds } from "@inkboard/shared/catalog-plan";
import { daysToExamLine, isPlateSubject, matchesTopic, plateCaption, setWallLedger, fmtWhen } from "@inkboard/shared/exam-wall";
import { COPY } from "@inkboard/shared/copy";
import { AddPracticeToPlan, AddTestToPlan } from "@/components/add-to-plan";
import { examsByGroup, examSeal, familyExams, groupTeachersBySubject, iconicSubjectGoal, teacherSubject, type Exam } from "@inkboard/shared/exams";
import { minutesFromSec, quizCaption, seriesCaption, seriesShortName, sittingDate, testsPlateCaption } from "@inkboard/shared/test-series";
import { practiceCaption, practicePlateCaption } from "@inkboard/shared/practice-lines";
import { papersCaption, papersForExam, strikePapers } from "@inkboard/shared/exam-papers";
import { liveTasks } from "@inkboard/shared/planner/types";
import { diffDays, todayKey } from "@inkboard/shared/planner/dates";
import { activePlan } from "@inkboard/shared/planner/storage";
import { usePlannerSelector } from "@inkboard/shared/planner/use-planner";
import { loadExamCourses, loadExamPractice, loadExamSubjectCourses, loadExamTests, loadTestSeriesItems, type ExamCourse, type ExamHub, type ExamSubject, type ExamTeacher } from "@/lib/unacademy";
import { readHistory, subscribeHistory } from "@inkboard/shared/watch-history";

function countsFor(
  name: string,
  courses: ExamCourse[],
  liveCount: number,
  playlists: { topic: string }[],
) {
  return plateCaption({
    courses: courses.filter((c) => matchesTopic(c.topic, name) || matchesTopic(c.name, name)).length,
    live: liveCount,
    playlists: playlists.filter((p) => matchesTopic(p.topic, name)).length,
  });
}

export function ExamHubView({
  hub,
  extraTeachers = [],
  extraCourses = [],
  compact,
  loadingMore,
  loadingCourses,
  onLoadMore,
  onLoadMoreCourses,
}: {
  hub: ExamHub;
  extraTeachers?: ExamTeacher[];
  extraCourses?: ExamCourse[];
  compact?: boolean;
  loadingMore?: boolean;
  loadingCourses?: boolean;
  onLoadMore?: () => void;
  onLoadMoreCourses?: () => void;
}) {
  const exam = hub.exam;
  const planned = usePlannerSelector(
    (s) => plannedCourseIds(activePlan(s)),
    (a, b) => a.size === b.size && [...a].every((id) => b.has(id)),
  );
  const daysLeft = usePlannerSelector((s) => {
    const plan = activePlan(s);
    if (!plan || plan.examId !== exam.id || !plan.prefs.examDate) return null;
    return diffDays(plan.prefs.examDate, todayKey());
  });
  const [topic, setTopic] = useState("all");
  const [filter, setFilter] = useState("");
  const [courseCap, setCourseCap] = useState(12);
  const [seriesUid, setSeriesUid] = useState<string | null>(null);
  const related = familyExams(exam);
  const onTests = topic === "tests";
  const onPapers = topic === "papers";
  const onPractice = topic === "practice";
  const faced = topic !== "all";
  const seal = examSeal(exam);
  const daysLine = daysToExamLine(daysLeft, seal);

  useEffect(() => {
    setCourseCap(12);
    setSeriesUid(null);
  }, [exam.id, topic]);

  const testsQ = useQuery({
    queryKey: ["exam-tests", "v1", exam.id],
    queryFn: () => loadExamTests({ data: { goalId: exam.id } }),
  });
  const seriesList = testsQ.data?.series ?? [];
  const practiceQ = useQuery({
    queryKey: ["exam-practice", "v1", exam.id],
    queryFn: () => loadExamPractice({ data: { goalId: exam.id } }),
  });
  const practiceLines = practiceQ.data?.lines ?? [];
  const crashDoors = hub.crash ?? [];
  const paperList = papersForExam(exam.id);
  const watchedTitles = useSyncExternalStore(
    subscribeHistory,
    () =>
      readHistory()
        .filter((h) => !h.examId || h.examId === exam.id)
        .map((h) => h.title)
        .join("\n"),
    () => "",
  );
  const doneTitles = usePlannerSelector(
    (s) => {
      const plan = activePlan(s);
      if (!plan || plan.examId !== exam.id) return [] as string[];
      return liveTasks(plan.tasks)
        .filter((t) => t.status === "done")
        .map((t) => t.title)
        .filter(Boolean);
    },
    (a, b) => a.length === b.length && a.every((t, i) => t === b[i]),
  );
  const struckRows = useMemo(() => {
    const watched = watchedTitles.split("\n").filter(Boolean);
    return strikePapers(paperList, [...watched, ...doneTitles]);
  }, [paperList, doneTitles, watchedTitles]);
  const openSeries = seriesList.find((s) => s.uid === seriesUid) ?? null;
  const itemsQ = useQuery({
    queryKey: ["test-items", "v1", seriesUid],
    enabled: Boolean(seriesUid),
    queryFn: () => loadTestSeriesItems({ data: { uid: seriesUid! } }),
  });

  const teachers = useMemo(
    () => [...hub.teachers, ...extraTeachers].filter((t) => t && t.username),
    [hub.teachers, extraTeachers],
  );
  const subjects = useMemo(() => {
    const seen = new Set<string>();
    const out: ExamSubject[] = [];
    for (const s of hub.subjects ?? []) {
      if (!s?.name) continue;
      const key = s.name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim() || s.uid;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out.filter((s) => isPlateSubject(s.name));
  }, [hub.subjects]);
  const hubPlaylists = useMemo(
    () => (hub.playlists ?? []).filter((p) => p && p.uid),
    [hub.playlists],
  );
  const hubTrending = useMemo(
    () => (hub.trending ?? []).filter((c) => c && c.uid),
    [hub.trending],
  );
  const hubCourses = useMemo(
    () => [...(hub.courses ?? []), ...extraCourses].filter((c) => c && c.uid),
    [hub.courses, extraCourses],
  );
  const hubLive = hub.live ?? [];
  const subjectNames = useMemo(() => subjects.map((s) => s.name), [subjects]);
  const chips = useMemo(() => {
    const map = new Map<string, string>();
    const add = (name: string) => {
      const t = name.trim();
      if (!t || t.toLowerCase() === "general" || t.toLowerCase() === "course") return;
      const key = t.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
      if (!key) return;
      const prev = map.get(key);
      if (!prev || t.length < prev.length) map.set(key, t);
    };
    for (const s of subjectNames) add(s);
    for (const p of hubPlaylists) if (p.topic) add(p.topic);
    for (const c of hubTrending) if (c.topic) add(c.topic);
    for (const c of hubCourses) if (c.topic) add(c.topic);
    for (const t of teachers) add(teacherSubject(t.topics));
    return ["all", ...map.values()];
  }, [hubPlaylists, hubTrending, hubCourses, subjectNames, teachers]);

  const plates = subjects.length
    ? subjects
    : chips
        .filter((id) => id !== "all")
        .slice(0, compact ? 8 : 16)
        .map((name) => ({ uid: name, name, icon: "" }));

  const activeSubject = subjects.find((s) => s.name === topic);
  const paperForTopic = exam.product === "iconic_pro" && topic !== "all" ? iconicSubjectGoal(topic) : null;
  const subjectQ = useQuery({
    queryKey: ["exam-subject", activeSubject?.uid, paperForTopic],
    enabled: topic !== "all" && (Boolean(paperForTopic) || (Boolean(activeSubject?.uid) && exam.product !== "iconic_pro")),
    queryFn: () =>
      paperForTopic
        ? loadExamCourses({ data: { goalId: paperForTopic, offset: 0 } }).then((p) => ({ courses: p.courses }))
        : loadExamSubjectCourses({ data: { topologyUid: activeSubject!.uid } }),
  });

  const playlists = hubPlaylists.filter((p) => matchesTopic(p.topic, topic));
  const trending = (subjectQ.data?.courses?.length ? subjectQ.data.courses : hubTrending).filter((c) =>
    topic === "all" || Boolean(activeSubject) || matchesTopic(c.topic, topic) || matchesTopic(c.name, topic),
  );
  const paperCourses = paperForTopic && subjectQ.data?.courses?.length ? subjectQ.data.courses : hubCourses;
  const courses = paperCourses.filter((c) => {
    if (topic === "all") return true;
    if (paperForTopic && c.goalUid === paperForTopic) return true;
    return matchesTopic(c.topic, topic) || matchesTopic(c.name, topic) || matchesTopic(c.goalName || "", topic);
  });
  const shownPlaylists = compact ? playlists.slice(0, 4) : playlists;
  const shownCourses = compact ? courses.slice(0, 6) : courses.slice(0, courseCap);
  const shownIds = new Set(shownCourses.map((c) => c.uid));
  const extraTrending = (compact ? trending.slice(0, 6) : trending.slice(0, 12)).filter((c) => !shownIds.has(c.uid));
  const moreCoursesLocal = !compact && courses.length > courseCap;
  const moreCoursesRemote = !compact && Boolean(onLoadMoreCourses);
  const coursesLeft = Math.max(0, (hub.coursesTotal || courses.length) - shownCourses.length);
  const groupedCourses =
    !compact && exam.product === "iconic_pro" && topic === "all"
      ? (() => {
          const map = new Map<string, ExamCourse[]>();
          for (const c of shownCourses) {
            const key = c.goalName || c.topic || "Courses";
            const list = map.get(key) ?? [];
            list.push(c);
            map.set(key, list);
          }
          return [...map.entries()];
        })()
      : [];
  const needle = filter.trim().toLowerCase();
  const shownTeachers = teachers.filter((t) => {
    if (topic !== "all" && !matchesTopic(t.topics, topic) && !matchesTopic(t.bio, topic) && !matchesTopic(teacherSubject(t.topics), topic)) {
      return false;
    }
    if (!needle) return true;
    return (
      t.name.toLowerCase().includes(needle) ||
      t.username.toLowerCase().includes(needle) ||
      String(t.topics ?? "").toLowerCase().includes(needle) ||
      String(t.bio ?? "").toLowerCase().includes(needle)
    );
  });
  const teacherSlice = compact ? shownTeachers.slice(0, 12) : shownTeachers;
  const groupedTeachers = !compact && topic === "all" && !needle ? groupTeachersBySubject(shownTeachers) : [];
  const live = compact ? hubLive.slice(0, 4) : hubLive;
  const showCourseShelf = !onTests && !onPapers && !onPractice && (faced || subjects.length === 0);
  const liveForPlate = (name: string) => hubLive.filter((s) => matchesTopic(s.title, name)).length;

  useEffect(() => {
    const last = readHistory().find((h) => h.teacher);
    const door = hubLive[0] ?? (hub.later ?? [])[0];
    setWallLedger({
      faced,
      examId: exam.id,
      upcomingTitle: door?.title,
      upcomingWhen: door ? (door.status === "live" ? "Live" : fmtWhen(door.liveAt) || "Soon") : undefined,
      upcomingLive: door?.status === "live",
      upcomingClassId: door?.classUid,
      upcomingReplayId: door?.replayId ?? undefined,
      upcomingSlug: door?.classSlug,
      lastTeacherName: last?.teacher,
      lastTeacherSlug: last?.teacher,
    });
    return () => setWallLedger(null);
  }, [faced, exam.id, hubLive, hub.later]);

  return (
    <div key={faced ? topic : "wall"} className="eraser-wipe">
      <header>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-seal text-muted">{exam.group}</p>
          {daysLine ? <p className="text-caption tabular text-muted">{daysLine}</p> : null}
        </div>
        {faced ? (
          <button
            type="button"
            onClick={() => {
              if (onTests && seriesUid) setSeriesUid(null);
              else setTopic("all");
            }}
            className="mt-5 text-sm text-muted hover:text-fg"
          >
            ← {onTests && seriesUid ? COPY.tests : "Subjects"}
          </button>
        ) : null}
        <h1 className="mt-2 text-2xl font-medium">
          {onTests ? (openSeries ? seriesShortName(openSeries.name) : COPY.tests) : onPapers ? COPY.papers : onPractice ? COPY.practice : faced ? topic : exam.name}
        </h1>
        <p className="mt-2 max-w-[65ch] text-sm text-muted">
          {onTests
            ? openSeries
              ? seriesCaption(openSeries)
              : testsPlateCaption(seriesList.length)
            : onPapers
              ? papersCaption(struckRows)
            : onPractice
              ? practicePlateCaption(practiceLines.length)
            : faced
              ? countsFor(topic, [...courses, ...trending], liveForPlate(topic), playlists)
              : exam.blurb}
        </p>
        {related.length > 1 ? (
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {related.map((r) => (
              <Link
                key={r.id}
                to="/exam/$goalId"
                params={{ goalId: r.id }}
                className={r.id === exam.id ? "text-primary" : "ink-underline text-muted"}
              >
                {r.name}
              </Link>
            ))}
          </p>
        ) : null}
      </header>

      {!faced && live.length ? (
        <section className="mt-10">
          <p className="text-seal text-faint">Doors</p>
          <DoorRow>
            {live.map((s) => (
              <LiveDoor key={s.classUid} slot={s} />
            ))}
            {crashDoors.map((d) => (
              <CrashDoor key={d.uid} door={d} />
            ))}
          </DoorRow>
        </section>
      ) : null}

      {!faced && !live.length && crashDoors.length ? (
        <section className="mt-10">
          <p className="text-seal text-faint">Doors</p>
          <DoorRow>
            {crashDoors.map((d) => (
              <CrashDoor key={d.uid} door={d} />
            ))}
          </DoorRow>
        </section>
      ) : null}

      {!faced && plates.length ? (
        <section className="mt-10">
          <p className="text-seal text-faint">Subjects</p>
          <PlateGrid>
            {plates.map((s) => (
              <SubjectPlate
                key={s.uid || s.name}
                name={s.name}
                caption={countsFor(s.name, hubCourses, liveForPlate(s.name), hubPlaylists)}
                selected={topic === s.name}
                onSelect={() => setTopic(s.name)}
              />
            ))}
            {seriesList.length ? (
              <SubjectPlate
                name={COPY.tests}
                caption={testsPlateCaption(seriesList.length)}
                selected={false}
                onSelect={() => setTopic("tests")}
              />
            ) : null}
            {paperList.length ? (
              <SubjectPlate
                name={COPY.papers}
                caption={papersCaption(struckRows)}
                selected={false}
                onSelect={() => setTopic("papers")}
              />
            ) : null}
            {practiceLines.length || practiceQ.isPending ? (
              <SubjectPlate
                name={COPY.practice}
                caption={practicePlateCaption(practiceLines.length)}
                selected={false}
                onSelect={() => setTopic("practice")}
              />
            ) : null}
          </PlateGrid>
        </section>
      ) : null}

      {faced && plates.length ? (
        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1">
          <MuteWord label="Wall" selected={false} onSelect={() => setTopic("all")} />
          {plates.map((s) => (
            <MuteWord
              key={s.uid || s.name}
              label={s.name}
              selected={topic === s.name}
              onSelect={() => setTopic(s.name)}
            />
          ))}
          {seriesList.length ? (
            <MuteWord label={COPY.tests} selected={onTests} onSelect={() => setTopic("tests")} />
          ) : null}
          {paperList.length ? (
            <MuteWord label={COPY.papers} selected={onPapers} onSelect={() => setTopic("papers")} />
          ) : null}
          {practiceLines.length || practiceQ.isPending ? (
            <MuteWord label={COPY.practice} selected={onPractice} onSelect={() => setTopic("practice")} />
          ) : null}
        </div>
      ) : null}

      {showCourseShelf && (shownCourses.length || shownPlaylists.length) ? (
        <section className="mt-10">
          <p className="text-seal text-faint">{faced ? "On this plate" : "Courses"}</p>
          {groupedCourses.length > 1 ? (
            <div className="mt-4 space-y-8">
              {groupedCourses.map(([paper, list]) => (
                <div key={paper}>
                  <p className="font-serif text-h3">{paper}</p>
                  <IndexShelf>
                    {list.map((c) => (
                      <CourseIndex key={c.uid} c={c} inPlan={planned.has(c.uid)} />
                    ))}
                  </IndexShelf>
                </div>
              ))}
            </div>
          ) : (
            <IndexShelf>
              {shownCourses.map((c) => (
                <CourseIndex key={c.uid} c={c} inPlan={planned.has(c.uid)} />
              ))}
              {shownPlaylists.map((p) => (
                <PlaylistIndex key={p.uid} p={p} />
              ))}
            </IndexShelf>
          )}
          {!compact && (moreCoursesLocal || moreCoursesRemote) ? (
            <InfiniteTrigger
              auto={false}
              onVisible={() => {
                setCourseCap((n) => n + 12);
                if (!moreCoursesLocal) onLoadMoreCourses?.();
              }}
              disabled={loadingCourses && !moreCoursesLocal}
              label={coursesLeft > 0 && coursesLeft < 80 ? `Show more courses · ${coursesLeft} left` : "Show more on this plate"}
            />
          ) : null}
        </section>
      ) : null}

      {showCourseShelf && extraTrending.length ? (
        <section className="mt-10">
          <p className="text-seal text-faint">{activeSubject ? activeSubject.name : "Opening now"}</p>
          <IndexShelf>
            {extraTrending.map((c) => (
              <CourseIndex key={c.uid} c={c} inPlan={planned.has(c.uid)} />
            ))}
          </IndexShelf>
        </section>
      ) : null}

      {onTests ? (
        <section className="mt-10">
          <p className="text-seal text-faint">{openSeries ? seriesShortName(openSeries.name) : COPY.tests}</p>
          {openSeries ? (
            <>
              {itemsQ.isPending ? (
                <p className="mt-4 text-sm text-muted">{COPY.boardIsComing}</p>
              ) : (
                <IndexShelf>
                  {(itemsQ.data?.items ?? []).map((item) => (
                    <div key={item.uid} className={`${catalogRowClass} items-baseline justify-between gap-4`}>
                      <div className="min-w-0">
                        <p className="text-seal tabular text-faint">{item.rank || "·"}</p>
                        <p className="mt-1 font-serif text-h3 leading-snug">{item.title}</p>
                        <p className="mt-2 text-caption text-muted">
                          {quizCaption(item)}
                          {item.startAt ? ` · ${fmtWhen(item.startAt, true)}` : ""}
                        </p>
                      </div>
                      <AddTestToPlan
                        title={item.title}
                        minutes={minutesFromSec(item.durationSec)}
                        date={sittingDate(item.startAt, todayKey())}
                      />
                    </div>
                  ))}
                </IndexShelf>
              )}
              {itemsQ.isError ? <p className="mt-4 text-sm text-muted">{COPY.shelfDidNotLoad}</p> : null}
            </>
          ) : (
            <IndexShelf>
              {seriesList.map((s, i) => (
                <button
                  key={s.uid}
                  type="button"
                  className={`${catalogRowClass} w-full text-left`}
                  onClick={() => setSeriesUid(s.uid)}
                >
                  <p className="text-seal tabular text-faint">{i + 1}</p>
                  <p className="mt-1 font-serif text-h3 leading-snug">{seriesShortName(s.name)}</p>
                  <p className="mt-2 text-caption text-muted">
                    {seriesCaption(s)}
                    {s.nextTitle ? ` · Next · ${s.nextTitle}` : ""}
                  </p>
                </button>
              ))}
            </IndexShelf>
          )}
        </section>
      ) : null}

      {onPapers ? (
        <section className="mt-10">
          <p className="text-seal text-faint">{COPY.papers}</p>
          <IndexShelf>
            {struckRows.map((p, i) => (
              <div key={p.id} className={`${catalogRowClass}${p.struck ? " is-done" : ""}`}>
                <p className="text-seal tabular text-faint">{i + 1}</p>
                <p className={`mt-1 font-serif text-h3 leading-snug${p.struck ? " strike-title is-on" : ""}`}>{p.name}</p>
                <p className="mt-2 text-caption text-muted">{p.struck ? p.hit : "Not on the board yet"}</p>
              </div>
            ))}
          </IndexShelf>
        </section>
      ) : null}

      {onPractice ? (
        <section className="mt-10">
          <p className="text-seal text-faint">{COPY.practice}</p>
          {practiceQ.isPending ? (
            <p className="mt-4 text-sm text-muted">{COPY.boardIsComing}</p>
          ) : (
            <IndexShelf>
              {practiceLines.map((line, i) => (
                <div key={line.uid} className={`${catalogRowClass} items-baseline justify-between gap-4`}>
                  <div className="min-w-0">
                    <p className="text-seal tabular text-faint">{i + 1}</p>
                    <p className="mt-1 font-serif text-h3 leading-snug">{line.title}</p>
                    <p className="mt-2 text-caption text-muted">{practiceCaption(line)}</p>
                  </div>
                  <AddPracticeToPlan title={line.title} questions={line.questions} />
                </div>
              ))}
            </IndexShelf>
          )}
          {practiceQ.isError ? <p className="mt-4 text-sm text-muted">{COPY.shelfDidNotLoad}</p> : null}
          {!practiceQ.isPending && !practiceLines.length ? (
            <p className="mt-4 text-sm text-muted">Nothing on this plate yet.</p>
          ) : null}
        </section>
      ) : null}

      {!onTests && !onPapers && !onPractice ? (
      <section className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <p className="text-seal text-faint">{faced ? `${topic}` : COPY.stamps}</p>
          {!compact ? (
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={COPY.writeATeacher}
              className="w-44 border-0 border-b border-line bg-transparent py-1 text-sm outline-none placeholder:text-faint focus:border-primary focus-visible:ring-1 focus-visible:ring-primary sm:w-56"
            />
          ) : null}
        </div>
        {groupedTeachers.length > 1 ? (
          <div className="space-y-8">
            {groupedTeachers.map(([subject, list]) => (
              <div key={subject}>
                <p className="mb-3 font-serif text-h3">{subject}</p>
                <StampRack>
                  {list.map((t) => (
                    <TeacherStamp key={t.uid || t.username} t={t} />
                  ))}
                </StampRack>
              </div>
            ))}
          </div>
        ) : (
          <StampRack>
            {teacherSlice.map((t) => (
              <TeacherStamp key={t.uid || t.username} t={t} />
            ))}
          </StampRack>
        )}
        {teacherSlice.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            {needle || faced ? COPY.noStampsMatch : COPY.rackEmpty}
            {needle || faced ? (
              <button
                type="button"
                onClick={() => {
                  setFilter("");
                  setTopic("all");
                }}
                className="ml-3 text-primary"
              >
                {COPY.backToTheWall}
              </button>
            ) : null}
          </p>
        ) : null}
        {compact && hub.total > teacherSlice.length ? (
          <Link
            to="/exam/$goalId"
            params={{ goalId: exam.id }}
            className="mt-4 inline-flex h-11 items-center text-sm text-primary"
          >
            {COPY.restOfTheRack}
          </Link>
        ) : null}
        {!compact && onLoadMore ? (
          <InfiniteTrigger auto={false} onVisible={onLoadMore} disabled={loadingMore} label={COPY.restOfTheRack} />
        ) : null}
      </section>
      ) : null}
    </div>
  );
}

export function ExamPickerGrid({ current }: { current?: Exam | null }) {
  return (
    <div className="space-y-8">
      {examsByGroup().map(({ group, families }) => (
        <div key={group}>
          <p className="text-seal text-muted">{group}</p>
          <div className="mt-3 space-y-4">
            {families.map((fam) => (
              <div key={`${group}-${fam.label || fam.exams[0]?.id}`}>
                {fam.label && fam.exams.length > 1 ? (
                  <p className="mb-1 text-caption text-faint">{fam.label}</p>
                ) : null}
                <ul className="divide-y divide-line border-y border-line">
                  {fam.exams.map((e) => (
                    <li key={e.id}>
                      <Link
                        to="/exam/$goalId"
                        params={{ goalId: e.id }}
                        className={`flex min-h-11 items-baseline justify-between gap-4 py-2.5 ${
                          e.id === current?.id ? "text-primary" : "text-fg"
                        }`}
                      >
                        <span className={`font-serif text-xl ${e.id === current?.id ? "" : "ink-underline"}`}>{e.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
