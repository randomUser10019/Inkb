import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { StrikeTitle } from "@/components/folio/shelf.tsx";
import { AddTaskForm } from "@/components/planner/add-task.tsx";
import { CatchUpLines, PaceCatchUpButton } from "@/components/planner/behind-banner.tsx";
import { BlankInstrument } from "@/components/planner/onboarding.tsx";
import { TaskRow } from "@/components/planner/task-row.tsx";
import { InlineAlert, KitSelect, SkeletonBlock } from "@/components/ui/planner/kit.tsx";
import { Dialog } from "@/components/ui/kit";
import { COPY } from "@inkboard/shared/copy";
import { chalkDust, studiedMinutesForDay } from "@inkboard/shared/planner/day-board";
import {
  addMonthsKey,
  addWeeksKey,
  formatDay,
  monthGrid,
  parseKey,
  todayKey,
  weekKeys,
} from "@inkboard/shared/planner/dates";
import { downloadIcs } from "@inkboard/shared/planner/ics";
import { getServerJournal, readJournal, subscribeJournal } from "@inkboard/shared/planner/journal";
import { createRecoveryPoint } from "@inkboard/shared/planner/recovery";
import { describeDiff, previewReschedule } from "@inkboard/shared/planner/scheduler/catchup";
import { slotCopy } from "@inkboard/shared/planner/scheduler";
import { getServerSessions, liveSessions, subscribeSessions } from "@inkboard/shared/planner/sessions";
import { paceLabel, planPace } from "@inkboard/shared/planner/streaks";
import {
  liveTasks,
  moveTask,
  moveTasks,
  replacePlanTasks,
  skipTasks,
  snapshotUndo,
  undoLast,
} from "@inkboard/shared/planner/storage";
import type { PlanTask } from "@inkboard/shared/planner/types";
import { usePlanner } from "@inkboard/shared/planner/use-planner";

const plannerRoute = getRouteApi("/planner/");

export function PlannerPage() {
  const search = plannerRoute.useSearch();
  const { plan, overdue, sync, retrySync, quotaError, atRisk, freezeLeft, savedByFreeze, state, date: today } = usePlanner();
  const [view, setView] = useState<"month" | "week" | "agenda">("month");
  const [cursor, setCursor] = useState(() => todayKey());
  const [open, setOpen] = useState<string>(() => search.day ?? todayKey());
  const [strategy, setStrategy] = useState(false);
  const [subject, setSubject] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [catchUp, setCatchUp] = useState(false);
  const journal = useSyncExternalStore(subscribeJournal, readJournal, getServerJournal);
  const sessions = useSyncExternalStore(subscribeSessions, liveSessions, getServerSessions);
  const journalDates = useMemo(
    () => new Set(journal.filter((e) => e.summary.trim() || e.wentWell.trim()).map((e) => e.date)),
    [journal],
  );
  const todayRef = useRef(today);
  useEffect(() => {
    if (todayRef.current === today) return;
    const previous = todayRef.current;
    todayRef.current = today;
    setCursor((c) => (c === previous ? today : c));
    if (!search.day) setOpen((d) => (d === previous ? today : d));
  }, [today, search.day]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = () => setView(mq.matches ? "agenda" : "month");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const month = parseKey(cursor).getMonth();
  const year = parseKey(cursor).getFullYear();
  const cells = view === "month" ? monthGrid(year, month) : weekKeys(cursor);
  const byDate = useMemo(() => {
    const map = new Map<string, PlanTask[]>();
    for (const t of liveTasks(plan?.tasks ?? [])) {
      if (subject && (t.subject || t.teacher) !== subject) continue;
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return map;
  }, [plan, subject]);
  const dayTasks = (open ? byDate.get(open) : undefined) ?? [];
  const daySessions = open ? sessions.filter((s) => s.date === open && !s.deletedAt) : [];
  const dayJournal = open ? journal.find((e) => e.date === open) : undefined;
  const subjects = [...new Set(liveTasks(plan?.tasks ?? []).map((t) => t.subject || t.teacher).filter(Boolean))];
  const agendaDays = view === "agenda" ? weekKeys(cursor) : [];
  const nextId = dayTasks.find((t) => t.status === "pending")?.id;
  const goal = plan?.prefs.dailyMinutes ?? 90;

  function shift(dir: number) {
    setCursor(view === "month" ? addMonthsKey(cursor, dir) : addWeeksKey(cursor, dir));
  }

  function applyStrategy(kind: "spread" | "push" | "skip") {
    if (!plan) return;
    if (!createRecoveryPoint("reschedule overdue")) {
      toast.error(`${COPY.recoveryMarkFail} Export a backup first.`);
      return;
    }
    const { tasks: next, diff } = previewReschedule(plan.tasks, plan.prefs, today, kind);
    snapshotUndo();
    replacePlanTasks(plan.id, next, next[next.length - 1]?.date);
    setStrategy(false);
    toast.success(describeDiff(diff), { action: { label: "Undo", onClick: () => undoLast() } });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Escape") {
        setStrategy(false);
        setAdding(false);
        return;
      }
      if (!open) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const i = cells.indexOf(open);
        if (i > 0) setOpen(cells[i - 1]!);
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const i = cells.indexOf(open);
        if (i >= 0 && i < cells.length - 1) setOpen(cells[i + 1]!);
      }
      if (e.key === "Enter" && open) {
        e.preventDefault();
        document.getElementById("planner-day-panel")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cells]);

  if ((sync === "syncing" || sync === "offline") && !plan) {
    return (
      <div className="space-y-4 py-8">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-80" />
      </div>
    );
  }

  if (!plan) return <BlankInstrument kicker={COPY.month} />;

  const livePlan = plan;
  const pace = planPace(livePlan, today, state.days);
  const monthTitle = view === "month" ? formatDay(cursor, "MMMM yyyy") : `Week of ${formatDay(weekKeys(cursor)[0]!)}`;

  function MiniBoard({ date }: { date: string }) {
    const list = byDate.get(date) ?? [];
    const overdueDay = list.some((t) => t.status === "pending" && date < today);
    const inMonth = date.slice(0, 7) === `${year}-${String(month + 1).padStart(2, "0")}`;
    const minutes = studiedMinutesForDay(date, sessions, list);
    const dust = chalkDust(minutes, goal);
    const wrote = journalDates.has(date);
    const hasExam = list.some((t) => t.eventKind === "exam") || date === livePlan.prefs.examDate;
    const hasHoliday = list.some((t) => t.eventKind === "holiday") || livePlan.prefs.holidays.includes(date);
    const struck = list.filter((t) => t.status === "done").length;
    return (
      <button
        type="button"
        onClick={() => setOpen(date)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData("text/task-id");
          if (id) moveTask(livePlan.id, id, date);
        }}
        aria-label={`${formatDay(date, "EEE d MMM")}, ${list.length} classes, ${struck} done${wrote ? ", journal written" : ""}${hasExam ? ", exam" : ""}${hasHoliday ? ", holiday" : ""}`}
        className={`mini-board${date === today ? " is-today" : ""}${open === date ? " is-open" : ""}${hasExam ? " is-exam" : ""}${overdueDay ? " is-overdue" : ""}${view === "month" && !inMonth ? " is-out" : ""}`}
        style={{ ["--dust" as string]: String(dust) }}
      >
        <span className="dust" aria-hidden="true" />
        {wrote ? <span className="journal-tick" aria-hidden="true" /> : null}
        <span className="day-num tabular">{date.slice(8)}</span>
        <span className="mt-auto text-xs text-muted">
          {list.length ? `${struck}/${list.length}` : hasHoliday ? "rest" : wrote ? "journal" : ""}
        </span>
      </button>
    );
  }

  return (
    <div className="py-8">
      <p className="text-seal text-faint">Month</p>
      <h1 className="text-2xl font-medium">{monthTitle}</h1>
      <p className="mt-2 text-sm text-muted">
        {plan.name} · {slotCopy(plan.prefs.timeSlot)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {pace.status === "behind" ? (
          <PaceCatchUpButton label={paceLabel(pace)} warn onOpen={() => setCatchUp(true)} />
        ) : null}
        <button type="button" onClick={() => downloadIcs(plan)} className="h-11 px-2 text-sm text-muted hover:text-fg">
          Export .ics
        </button>
      </div>
      {sync === "error" ? (
        <div className="mt-4">
          <InlineAlert
            title="Not synced"
            body="Changes are still saved on this device."
            action={
              <button type="button" className="text-sm text-primary" onClick={() => void retrySync()}>
                Retry
              </button>
            }
          />
        </div>
      ) : null}
      {quotaError ? <p className="mt-3 text-sm text-danger">{quotaError}</p> : null}
      <div className="mt-4">
        <CatchUpLines
          planId={plan.id}
          tasks={plan.tasks}
          prefs={plan.prefs}
          today={today}
          force={catchUp || pace.status === "behind"}
        />
      </div>
      {overdue.length ? (
        <p className="mt-4 text-sm text-warn">
          {overdue.length} overdue class{overdue.length === 1 ? "" : "es"}.{" "}
          <button type="button" className="ink-underline" onClick={() => setStrategy(true)}>
            Reschedule
          </button>
        </p>
      ) : null}
      {atRisk ? <p className="mt-3 text-sm text-warn">Mark at risk — nothing logged today.</p> : null}
      {savedByFreeze ? (
        <p className="mt-3 text-caption text-warn">
          Saved by freeze · {freezeLeft} freeze left this week
        </p>
      ) : (
        <p className="mt-3 text-caption text-muted">{freezeLeft} freeze left this week</p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button type="button" className="h-11 text-sm text-muted hover:text-fg" onClick={() => shift(-1)} aria-label="Previous">
            ‹
          </button>
          <button type="button" className="h-11 px-3 text-sm text-muted hover:text-fg" onClick={() => setCursor(today)}>
            Today
          </button>
          <button type="button" className="h-11 text-sm text-muted hover:text-fg" onClick={() => shift(1)} aria-label="Next">
            ›
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {subjects.length > 1 ? (
            <KitSelect
              value={subject}
              onChange={setSubject}
              ariaLabel="Filter by subject"
              options={[{ id: "", label: "All subjects" }, ...subjects.map((s) => ({ id: s, label: s }))]}
            />
          ) : null}
          <div role="tablist" aria-label="Calendar view" className="flex gap-4 text-sm">
            {(
              [
                ["month", "Month"],
                ["week", "Week"],
                ["agenda", "Agenda"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                className={view === id ? "text-fg" : "text-muted hover:text-fg"}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted" aria-label="Calendar legend">
        <li>Dust · minutes studied (Done)</li>
        <li>Stone underline · Overdue</li>
        <li>Oxide ring · Exam</li>
        <li>Bone edge · today</li>
        <li>Tick · Journal</li>
      </ul>

      {view === "agenda" ? (
        <ol className="mt-4">
          {agendaDays.map((date) => {
            const list = byDate.get(date) ?? [];
            return (
              <li key={date} className="border-b border-line py-3">
                <button type="button" className="text-left" onClick={() => setOpen(date)}>
                  <p className="font-serif text-h3">{formatDay(date, "EEEE d MMM")}</p>
                  <p className="text-caption text-muted">{list.length} classes</p>
                </button>
                <ul className="mt-2 space-y-1">
                  {list.slice(0, 4).map((t) => (
                    <li key={t.id} className="truncate text-sm">
                      <StrikeTitle done={t.status === "done"} className="truncate">
                        {t.title}
                      </StrikeTitle>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={`mt-4 grid gap-1.5 ${view === "month" ? "grid-cols-7" : "grid-cols-1 sm:grid-cols-7"}`}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-1 text-center text-xs text-muted">
              {d}
            </div>
          ))}
          {cells.map((date) => (
            <MiniBoard key={date} date={date} />
          ))}
        </div>
      )}

      <section id="planner-day-panel" tabIndex={-1} className="mt-10 max-w-[65ch] outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <p className="text-seal text-faint">{open === today ? "today" : open ? "day" : ""}</p>
        <h2 className="font-serif text-h1">{open ? formatDay(open, "EEEE d MMM") : "Pick a day"}</h2>
        {dayJournal && (dayJournal.summary.trim() || dayJournal.mood) ? (
          <p className="mt-2 text-caption text-muted">
            Journal · mood {dayJournal.mood}/5
            {dayJournal.summary.trim() ? ` · ${dayJournal.summary}` : ""}
          </p>
        ) : null}
        {daySessions.length ? (
          <p className="mt-1 text-caption text-muted">
            {daySessions.length} session{daySessions.length === 1 ? "" : "s"} ·{" "}
            {daySessions.reduce((n, s) => n + s.durationMin, 0)} min logged
          </p>
        ) : null}
        {open ? (
          <button type="button" className="mt-2 h-11 text-sm text-muted hover:text-fg" onClick={() => setAdding((v) => !v)}>
            Write a task
          </button>
        ) : null}
        {adding && open ? (
          <div className="mt-1 border-t border-line py-3">
            <AddTaskForm plan={plan} date={open} onDone={() => setAdding(false)} />
          </div>
        ) : null}
        {selected.length ? (
          <div className="mt-3 flex flex-wrap gap-3 text-caption">
            <button
              type="button"
              className="text-primary"
              onClick={() => {
                skipTasks(plan.id, selected);
                setSelected([]);
                toast.success("Skipped", { action: { label: "Undo", onClick: () => undoLast() } });
              }}
            >
              Skip selected
            </button>
            {open ? (
              <button
                type="button"
                className="text-primary"
                onClick={() => {
                  moveTasks(plan.id, selected, open);
                  setSelected([]);
                  toast.success("Moved", { action: { label: "Undo", onClick: () => undoLast() } });
                }}
              >
                Move selected here
              </button>
            ) : null}
            <button type="button" className="text-muted" onClick={() => setSelected([])}>
              Clear
            </button>
          </div>
        ) : null}
        {!dayTasks.length ? (
          <p className="mt-4 text-sm text-muted">Nothing scheduled this day.</p>
        ) : (
          <ul className="mt-4">
            {dayTasks.map((t, i) => (
              <li key={t.id}>
                <TaskRow
                  plan={plan}
                  task={t}
                  index={i + 1}
                  next={t.id === nextId}
                  selected={selected.includes(t.id)}
                  onToggleSelect={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {strategy ? (
        <Dialog title="Reschedule overdue" onClose={() => setStrategy(false)}>
          <p className="mt-1 text-sm">Completed classes stay put.</p>
          <div className="mt-3 grid gap-1">
            <button type="button" className="h-11 text-left text-sm" onClick={() => applyStrategy("spread")}>
              Spread into spare days
            </button>
            <button type="button" className="h-11 text-left text-sm" onClick={() => applyStrategy("push")}>
              Push everything forward
            </button>
            <button type="button" className="h-11 text-left text-sm" onClick={() => applyStrategy("skip")}>
              Skip overdue
            </button>
            <button type="button" className="h-11 text-left text-sm text-muted" onClick={() => setStrategy(false)}>
              Cancel
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}
