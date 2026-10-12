import { Link, getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LogStudyDialog } from "@/components/planner/log-study.tsx";
import { PlannerOnboarding } from "@/components/planner/onboarding.tsx";
import { AddTaskForm } from "@/components/planner/add-task.tsx";
import { TaskRow } from "@/components/planner/task-row.tsx";
import { InlineAlert } from "@/components/ui/planner/kit.tsx";
import { Badge, Button, Card, EmptyState, Menu, Progress, Skeleton, toast, Tooltip } from "@/components/ui/kit";
import { formatRemain } from "@inkboard/shared/folio";
import { orderQueue, queueClockTimes, queueRemaining, shortenDay } from "@inkboard/shared/planner/daily";
import { dayRemainCopy, slotCaption } from "@inkboard/shared/planner/day-board";
import { formatDay } from "@inkboard/shared/planner/dates";
import { clearSessionSummary, focusClock, readSessionSummary, type SessionSummary } from "@inkboard/shared/planner/focus";
import { cacheTodayPlan } from "@inkboard/shared/planner/offline";
import { DEFAULT_PROFILE, readProfile } from "@inkboard/shared/planner/profile";
import { scheduleInAppBanner } from "@inkboard/shared/planner/reminders";
import { moveTasks, reorderDay, skipTasks, undoLast } from "@inkboard/shared/planner/storage";
import { nextAction } from "@inkboard/shared/planner/next-action";
import { usePlanner } from "@inkboard/shared/planner/use-planner";
import { streakDaysCopy } from "@inkboard/shared/copy";

const todayRoute = getRouteApi("/planner/today");

export function PlannerTodayPage() {
  const { plan, today, overdue, streak, sync, retrySync, atRisk, date } = usePlanner();
  const search = todayRoute.useSearch();
  const [logOpen, setLogOpen] = useState(false);
  const [adding, setAdding] = useState(() => Boolean(search.add));
  const [hour12, setHour12] = useState(DEFAULT_PROFILE.hour12);
  const queue = useMemo(() => orderQueue(today), [today]);
  const clocks = useMemo(
    () => queueClockTimes(queue, plan?.prefs.timeSlot ?? "evening", hour12),
    [queue, plan?.prefs.timeSlot, hour12],
  );
  const remaining = queueRemaining(queue);
  const [focusOn, setFocusOn] = useState(false);
  const [focusElapsed, setFocusElapsed] = useState(0);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const reminder = plan ? scheduleInAppBanner(plan.prefs, today) : null;
  const pending = queue.filter((t) => t.status === "pending");
  const done = queue.filter((t) => t.status === "done").length;
  const todayPct = queue.length ? Math.round((done / queue.length) * 100) : 0;
  const nextId = pending[0]?.id;
  const action = nextAction({
    overdue: overdue.length,
    pending: pending.map((task) => ({ title: task.title, lessonId: task.lessonId })),
    resume: null,
  });
  const short = shortenDay(queue, plan?.prefs.hardMaxLecturesPerDay ?? 5);

  useEffect(() => {
    setHour12(readProfile().hour12);
    setSummary(readSessionSummary());
  }, []);

  useEffect(() => {
    if (!focusOn) return;
    const id = window.setInterval(() => setFocusElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [focusOn]);

  useEffect(() => {
    cacheTodayPlan(plan, date);
  }, [plan, date]);

  const clock = focusClock(focusElapsed);

  if ((sync === "syncing" || sync === "offline") && !plan) {
    return (
      <div className="max-w-[65ch] space-y-3 py-8">
        <Skeleton className="h-10" />
        <Skeleton className="h-16" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (!plan) return <PlannerOnboarding />;

  const planId = plan.id;

  function move(id: string, dir: -1 | 1) {
    const ids = queue.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    const [hit] = next.splice(i, 1);
    if (hit) next.splice(j, 0, hit);
    reorderDay(planId, date, next);
  }

  function shorten() {
    if (!short.dropIds.length) {
      toast.message(short.reason);
      return;
    }
    skipTasks(planId, short.dropIds);
    toast.success(short.reason, { action: { label: "Undo", onClick: () => undoLast() } });
  }

  return (
    <div className="max-w-[65ch] py-8">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-faint uppercase">{slotCaption(plan.prefs.timeSlot)}</p>
            <h1 className="text-h1">{formatDay(date, "EEEE d MMMM")}</h1>
            <p className="mt-2 text-sm text-muted tabular-nums">{dayRemainCopy(remaining.pending, remaining.minutes)}</p>
            {streak.current ? <Badge tone="ok">{streakDaysCopy(streak.current)}</Badge> : null}
          </div>
          <Progress value={todayPct} label="Today" variant="ring" />
        </div>
      </Card>
      <div className="mt-3">
        <Button
          type="button"
          variant="quiet"
          onClick={() => {
            setFocusOn((on) => !on);
            if (focusOn) setFocusElapsed(0);
          }}
        >
          {clock.phase === "done" ? "Focus done" : clock.phase === "break" ? "Break" : "Focus"}{" "}
          {Math.ceil(clock.leftSec / 60)} min
        </Button>
      </div>
      {atRisk ? <p className="mt-1 text-caption text-warn">Mark at risk — nothing logged today.</p> : null}
      {sync === "error" ? (
        <div className="mt-4">
          <InlineAlert
            title="Not synced"
            body="Changes are still saved on this device."
            action={
              <Button type="button" variant="quiet" onClick={() => void retrySync()}>
                Retry
              </Button>
            }
          />
        </div>
      ) : null}
      {reminder ? <p className="mt-3 text-caption text-muted">{reminder}</p> : null}
      {overdue.length ? (
        <div className="mt-3">
          <Button
            type="button"
            onClick={() => {
              moveTasks(planId, overdue.map((task) => task.id), date);
              toast.success(overdue.length === 1 ? "1 class moved to today" : `${overdue.length} classes moved to today`);
            }}
          >
            {action.label}
          </Button>
        </div>
      ) : action.kind === "start" || action.kind === "resume" ? (
        <p className="mt-3">
          <a href={action.href} className="inline-flex h-11 items-center text-sm font-semibold text-primary">
            {action.label}
          </a>
        </p>
      ) : null}
      {summary ? (
        <p className="mt-4 text-sm text-muted">
          Session complete · {summary.tasksDone}/{summary.queue} struck
          {streak.current ? ` · ${streakDaysCopy(streak.current)}` : ""}{" "}
          <button
            type="button"
            className="ink-underline text-caption"
            onClick={() => {
              clearSessionSummary();
              setSummary(null);
            }}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      <div className="mt-6">
        <Menu
          label="Day actions"
          items={[
            { id: "shorten", label: "Shorten", onSelect: shorten },
            { id: "log", label: "Log study", onSelect: () => setLogOpen(true) },
          ]}
        />
      </div>

      {logOpen ? <LogStudyDialog open onClose={() => setLogOpen(false)} /> : null}

      <ol className="mt-8">
        {selected.length ? (
          <li className="mb-3 flex flex-wrap items-center gap-3 text-caption">
            <span className="tabular">{selected.length} selected</span>
            <button
              type="button"
              className="text-primary"
              onClick={() => {
                skipTasks(planId, selected);
                setSelected([]);
                toast.success("Skipped", { action: { label: "Undo", onClick: () => undoLast() } });
              }}
            >
              Skip
            </button>
            <button
              type="button"
              className="text-primary"
              onClick={() => {
                moveTasks(planId, selected, date);
                setSelected([]);
                toast.success("Kept on today", { action: { label: "Undo", onClick: () => undoLast() } });
              }}
            >
              Keep on today
            </button>
            <button type="button" className="text-muted" onClick={() => setSelected([])}>
              Clear
            </button>
          </li>
        ) : null}
        {queue.length ? (
          queue.map((t, i) => (
            <li key={t.id}>
              <TaskRow
                plan={plan}
                task={t}
                clock={clocks.get(t.id)}
                index={i + 1}
                next={t.id === nextId}
                selected={selected.includes(t.id)}
                onToggleSelect={(id) => setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))}
                onMove={(dir) => move(t.id, dir)}
                canMoveUp={i > 0}
                canMoveDown={i < queue.length - 1}
              />
            </li>
          ))
        ) : (
          <li>
            <EmptyState title="Queue clear" body="Rest, or log study you already did." />
          </li>
        )}
        <li>
          {adding ? (
            <div className="border-b border-line py-3">
              <AddTaskForm plan={plan} date={date} onDone={() => setAdding(false)} />
            </div>
          ) : (
            <Tooltip label="Press N">
              <button type="button" className="write-task" onClick={() => setAdding(true)}>
                Write a task
              </button>
            </Tooltip>
          )}
        </li>
      </ol>

      <p className="mt-10 text-caption text-faint">
        <Link to="/planner/journal" className="ink-underline">
          Journal
        </Link>
      </p>
    </div>
  );
}
