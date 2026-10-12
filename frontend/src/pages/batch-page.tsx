import { Link, useParams, useSearch } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";

import { ChalkLead, ChalkRow, Brief, MuteWord, LineSkel, ShelfEmpty, useShelfLedger, WriteField } from "@/components/folio/shelf";

import { LaterButton } from "@/components/watch-later";

import { AppErrorComponent } from "@/lib/error-component";

import { coverageRatio, lineState, nextOpenIndex } from "@inkboard/shared/shelf";

import { loadBatchDetail, loadBatchSchedule, type BatchSession } from "@/lib/unacademy";

import { peekProgress } from "@inkboard/shared/watch-history";

import { readWatchLogs } from "@inkboard/shared/planner/watch-store";

import { COPY } from "@inkboard/shared/copy";

type ViewMode = "week" | "list";

type Range = "all" | "today" | "week";

function fmtWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayKey(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function byTime(a: BatchSession, b: BatchSession, dir: 1 | -1) {
  const ta = a.liveAt ? new Date(a.liveAt).getTime() : 0;
  const tb = b.liveAt ? new Date(b.liveAt).getTime() : 0;
  return (ta - tb) * dir;
}

function SessionRow({
  s,
  teacher,
  n,
  struck,
  next,
}: {
  s: BatchSession;
  teacher?: string;
  n: number;
  struck?: boolean;
  next?: boolean;
}) {
  const live = s.status === "live";
  const lead = (
    <ChalkLead
      n={s.rank || n}
      title={s.title}
      meta={[s.authorName, s.liveAt ? fmtWhen(s.liveAt) : "", struck ? "" : next ? "" : ""]
        .filter(Boolean)
        .join(" · ")}
      struck={struck}
      next={next}
      live={live}
    />
  );
  const actions = s.replayId ? (
    <LaterButton lessonId={s.replayId} title={s.title} teacher={s.authorUsername || teacher} course={s.courseUid} />
  ) : null;
  const cls = "chalk-line";
  return (
    <ChalkRow struck={struck} next={next} actions={actions}>
      {s.replayId && !live ? (
        <Link
          to="/play/$lessonId"
          params={{ lessonId: s.replayId }}
          search={{ title: s.title, teacher: s.authorUsername || teacher, course: s.courseUid }}
          className={cls}
        >
          {lead}
        </Link>
      ) : (
        <Link to="/live/$classId" params={{ classId: s.uid }} search={{ slug: s.slug, course: s.courseUid }} className={cls}>
          {lead}
        </Link>
      )}
    </ChalkRow>
  );
}

function WeekCard({ s, teacher }: { s: BatchSession; teacher?: string }) {
  const live = s.status === "live";
  const body = (
    <>
      <p className="text-caption tabular text-muted">{fmtTime(s.liveAt) || "—"}</p>
      <p className="mt-1 line-clamp-2 text-sm">{s.title}</p>
      <p className="mt-1 truncate text-caption text-faint">{s.authorName}</p>
      {live ? <p className="mt-1 text-seal text-danger">Live</p> : null}
    </>
  );
  if (s.replayId && !live) {
    return (
      <Link
        to="/play/$lessonId"
        params={{ lessonId: s.replayId }}
        search={{ title: s.title, teacher: s.authorUsername || teacher, course: s.courseUid }}
        className="week-session"
      >
        {body}
      </Link>
    );
  }
  return (
    <Link to="/live/$classId" params={{ classId: s.uid }} search={{ slug: s.slug, course: s.courseUid }} className="week-session">
      {body}
    </Link>
  );
}

export default function BatchPage() {
  const { batchId } = useParams({ from: "/batch/$batchId" });
  const { slug } = useSearch({ from: "/batch/$batchId" });
  const [extraPast, setExtraPast] = useState<BatchSession[]>([]);
  const [pastRank, setPastRank] = useState<number | null>(null);
  const [loadingPast, setLoadingPast] = useState(false);
  const [pastError, setPastError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [range, setRange] = useState<Range>("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [classQ, setClassQ] = useState("");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const q = useQuery({
    queryKey: ["batch", "v3", batchId],
    queryFn: async () => {
      const page = await loadBatchDetail({ data: { uid: batchId, slug } });
      setExtraPast([]);
      setPastRank(page.nextPastRank);
      setPastError(null);
      return page;
    },
  });

  const sessions = useMemo(() => {
    const first = q.data?.sessions ?? [];
    const seen = new Set(first.map((s) => s.uid));
    return [...first, ...extraPast.filter((s) => !seen.has(s.uid))];
  }, [q.data?.sessions, extraPast]);

  const authors = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of q.data?.batch.authors ?? []) {
      if (a.username) map.set(a.username, a.name);
    }
    for (const s of sessions) {
      if (s.authorUsername && !map.has(s.authorUsername)) map.set(s.authorUsername, s.authorName);
    }
    return [...map.entries()].map(([username, name]) => ({ username, name }));
  }, [q.data?.batch.authors, sessions]);

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const week0 = startOfWeek(new Date());
    const week1 = addDays(week0, 7);
    return sessions.filter((s) => {
      if (teacherFilter !== "all" && s.authorUsername !== teacherFilter) return false;
      if (classQ.trim() && !s.title.toLowerCase().includes(classQ.trim().toLowerCase())) return false;
      if (range === "all") return true;
      if (!s.liveAt) return range !== "today";
      const t = new Date(s.liveAt).getTime();
      if (range === "today") return t >= today.getTime() && t < addDays(today, 1).getTime();
      return t >= week0.getTime() && t < week1.getTime();
    });
  }, [sessions, teacherFilter, range, classQ]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const key = day.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const list = filtered
        .filter((s) => dayKey(s.liveAt) === key)
        .sort((a, b) => byTime(a, b, 1));
      return { day, key, list };
    });
  }, [weekStart, filtered]);

  if (q.isLoading) {
    return (
      <AppShell>
        <main className="board-pad">
          <LineSkel />
        </main>
      </AppShell>
    );
  }

  if (q.isError || !q.data) {
    return (
      <AppShell>
        <main className="board-pad">
          <ShelfEmpty
            title={COPY.shelfDidNotLoad}
            body={q.error instanceof Error ? q.error.message : COPY.shelfDidNotLoad}
            action={
              <Link to="/" className="ink-underline text-sm text-muted">
                {COPY.backToTheWall}
              </Link>
            }
          />
        </main>
      </AppShell>
    );
  }

  const { batch } = q.data;
  const live = filtered.filter((s) => s.status === "live");
  const upcoming = filtered.filter((s) => s.status === "upcoming").sort((a, b) => byTime(a, b, 1));
  const past = filtered.filter((s) => s.status !== "live" && s.status !== "upcoming").sort((a, b) => byTime(a, b, -1));
  const teacher = batch.authors[0]?.username;
  const weekLabel = `${weekStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${addDays(weekStart, 6).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  const isThisWeek = startOfWeek(new Date()).getTime() === weekStart.getTime();

  async function loadOlder() {
    if (pastRank == null || loadingPast) return;
    setLoadingPast(true);
    setPastError(null);
    try {
      const page = await loadBatchSchedule({
        data: { uid: batchId, past: true, rank: pastRank },
      });
      setExtraPast((prev) => {
        const have = new Set([...sessions, ...prev].map((s) => s.uid));
        return [...prev, ...page.sessions.filter((s) => !have.has(s.uid))];
      });
      setPastRank(page.nextRank);
      if (page.sessions.length === 0 && page.nextRank == null) setPastRank(null);
    } catch (err) {
      setPastError(err instanceof Error ? err.message : "Older classes did not load.");
    } finally {
      setLoadingPast(false);
    }
  }

  return (
    <BatchBoard
      batch={batch}
      teacher={teacher}
      live={live}
      upcoming={upcoming}
      past={past}
      filtered={filtered}
      view={view}
      setView={setView}
      range={range}
      setRange={setRange}
      setWeekStart={setWeekStart}
      weekStart={weekStart}
      weekLabel={weekLabel}
      isThisWeek={isThisWeek}
      weekDays={weekDays}
      authors={authors}
      teacherFilter={teacherFilter}
      setTeacherFilter={setTeacherFilter}
      classQ={classQ}
      setClassQ={setClassQ}
      pastRank={pastRank}
      loadingPast={loadingPast}
      pastError={pastError}
      loadOlder={loadOlder}
      sessionsCount={sessions.length}
    />
  );
}

function BatchBoard({
  batch,
  teacher,
  live,
  upcoming,
  past,
  filtered,
  view,
  setView,
  range,
  setRange,
  setWeekStart,
  weekStart,
  weekLabel,
  isThisWeek,
  weekDays,
  authors,
  teacherFilter,
  setTeacherFilter,
  classQ,
  setClassQ,
  pastRank,
  loadingPast,
  pastError,
  loadOlder,
  sessionsCount,
}: {
  batch: { name: string; goalName: string; syllabusTag?: string; description?: string; lessonsCount: number; liveClasses: number; authors: { username: string; name: string }[] };
  teacher?: string;
  live: BatchSession[];
  upcoming: BatchSession[];
  past: BatchSession[];
  filtered: BatchSession[];
  view: ViewMode;
  setView: (v: ViewMode) => void;
  range: Range;
  setRange: (v: Range) => void;
  setWeekStart: (fn: (d: Date) => Date) => void;
  weekStart: Date;
  weekLabel: string;
  isThisWeek: boolean;
  weekDays: { day: Date; key: string; list: BatchSession[] }[];
  authors: { username: string; name: string }[];
  teacherFilter: string;
  setTeacherFilter: (v: string) => void;
  classQ: string;
  setClassQ: (v: string) => void;
  pastRank: number | null;
  loadingPast: boolean;
  pastError: string | null;
  loadOlder: () => void;
  sessionsCount: number;
}) {
  const logs = typeof window === "undefined" ? [] : readWatchLogs();
  const listed = [...live, ...upcoming, ...past];
  const states = listed.map((s) =>
    lineState({
      watchedSec: s.replayId ? peekProgress(s.replayId) : 0,
      durationSec: s.durationSec,
      coverage: s.replayId ? coverageRatio(logs, s.replayId, s.durationSec) : 0,
    }),
  );
  const nextIdx = nextOpenIndex(states);
  const nextTitle = nextIdx >= 0 ? listed[nextIdx]?.title : undefined;
  useShelfLedger({
    kicker: "Batch",
    title: batch.name,
    meta: batch.lessonsCount ? `${batch.lessonsCount} classes` : `${sessionsCount} on the timetable`,
    teacher,
    next: nextTitle,
  });

  function lineOf(s: BatchSession, fallback: number) {
    const i = listed.findIndex((x) => x.uid === s.uid);
    return (
      <SessionRow
        key={s.uid}
        s={s}
        teacher={teacher}
        n={s.rank || fallback}
        struck={i >= 0 && states[i] === "struck"}
        next={i === nextIdx}
      />
    );
  }

  return (
    <AppShell>
      <main className="board-pad">
        {teacher ? (
          <Link
            to="/teacher/$slug"
            params={{ slug: teacher }}
            search={{ tab: "batches" }}
            className="ink-underline text-sm text-muted"
          >
            ← {batch.authors[0]?.name || "Teacher"}
          </Link>
        ) : (
          <Link to="/" className="ink-underline text-sm text-muted">
            ← All exams
          </Link>
        )}

        <p className="mt-4 text-sm text-muted">
          {batch.goalName || "Batch"}
          {batch.syllabusTag ? ` · ${batch.syllabusTag}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-medium">{batch.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {batch.lessonsCount ? `${batch.lessonsCount} classes` : `${sessionsCount} on the timetable`}
          {batch.liveClasses ? ` · ${batch.liveClasses} live planned` : ""}
          {past.length ? ` · ${past.length} listed` : ""}
        </p>
        {batch.description ? <Brief text={batch.description} /> : null}
        {batch.authors.length ? <p className="mt-2 text-caption text-faint">{batch.authors.map((a) => a.name).join(" · ")}</p> : null}

        <div className="mt-6">
          <WriteField value={classQ} onChange={setClassQ} label="Find a class" placeholder="Find a class" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <MuteWord label="Week" selected={view === "week"} onSelect={() => setView("week")} />
            <MuteWord label="List" selected={view === "list"} onSelect={() => setView("list")} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(
              [
                ["all", "All"],
                ["today", "Today"],
                ["week", "This week"],
              ] as const
            ).map(([id, label]) => (
              <MuteWord
                key={id}
                label={label}
                selected={range === id}
                onSelect={() => {
                  setRange(id);
                  if (id === "week" || id === "today") setWeekStart(() => startOfWeek(new Date()));
                }}
              />
            ))}
          </div>
          {authors.length > 1 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <MuteWord label="All teachers" selected={teacherFilter === "all"} onSelect={() => setTeacherFilter("all")} />
              {authors.map((a) => (
                <MuteWord
                  key={a.username}
                  label={a.name}
                  selected={teacherFilter === a.username}
                  onSelect={() => setTeacherFilter(a.username)}
                />
              ))}
            </div>
          ) : null}
        </div>

        {view === "week" ? (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setWeekStart((d) => addDays(d, -7))}
                className="grid size-11 place-items-center text-muted hover:text-fg"
                aria-label="Previous week"
              >
                ←
              </button>
              <div className="text-center">
                <p className="font-serif text-sm">{weekLabel}</p>
                <p className="text-caption text-muted">{isThisWeek ? "This week" : "Timetable"}</p>
              </div>
              <button
                type="button"
                onClick={() => setWeekStart((d) => addDays(d, 7))}
                className="grid size-11 place-items-center text-muted hover:text-fg"
                aria-label="Next week"
              >
                →
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-7">
              {weekDays.map(({ day, key, list }) => {
                const today = startOfDay(new Date()).getTime() === startOfDay(day).getTime();
                return (
                  <div key={key} className={`week-board${today ? " is-today" : ""}`}>
                    <p className={`text-caption ${today ? "text-fg" : "text-muted"}`}>
                      {day.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}
                    </p>
                    <div className="mt-2">
                      {list.length ? (
                        list.map((s) => <WeekCard key={s.uid} s={s} teacher={teacher} />)
                      ) : (
                        <p className="py-6 text-center text-caption text-faint">Blank</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {pastRank != null ? (
              <div className="mt-4">
                <button type="button" onClick={() => void loadOlder()} disabled={loadingPast} className="h-11 text-sm text-muted hover:text-fg disabled:opacity-60">
                  Older classes
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <>
            {live.length ? (
              <section className="mt-8">
                <p className="text-seal mb-2 text-danger">Doors</p>
                <ol>{live.map((s, i) => lineOf(s, i + 1))}</ol>
              </section>
            ) : null}
            {upcoming.length ? (
              <section className="mt-8">
                <p className="text-seal mb-2 text-faint">Upcoming</p>
                <ol>{upcoming.map((s, i) => lineOf(s, i + 1))}</ol>
              </section>
            ) : null}
            {past.length ? (
              <section className="mt-8">
                <p className="text-seal mb-2 text-faint">In this class</p>
                <ol>{past.map((s, i) => lineOf(s, i + 1))}</ol>
                {pastError ? <p className="mt-3 text-sm text-danger">{pastError}</p> : null}
                {pastRank != null ? (
                  <button type="button" onClick={() => void loadOlder()} disabled={loadingPast} className="mt-4 h-11 text-sm text-muted hover:text-fg disabled:opacity-60">
                    Older classes
                  </button>
                ) : (
                  <p className="mt-3 text-caption text-faint">All recorded classes are listed.</p>
                )}
              </section>
            ) : filtered.length === 0 ? (
              <ShelfEmpty title="No classes match that" body="Try All, or another teacher on this batch." />
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  );
}
