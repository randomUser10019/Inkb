import { useMemo, useState, useSyncExternalStore } from "react";

import { toast } from "sonner";

import { RevisionHealthPanel } from "@/components/planner/revision-panel.tsx";

import { LineChart, SegmentedControl } from "@/components/ui/planner/kit.tsx";

import { AppErrorComponent } from "@/lib/error-component";

import { analyticsFor } from "@inkboard/shared/planner/analytics";

import { formatClock } from "@inkboard/shared/planner/daily";

import { formatDay, todayKey } from "@inkboard/shared/planner/dates";

import { allHistoryRows, previousPeriod, rangeBounds } from "@inkboard/shared/planner/history";

import { subjectHatchClassFor, subjectMark } from "@inkboard/shared/planner/subjects";

import { readProfile } from "@inkboard/shared/planner/profile";

import { getServerSessions, liveSessions, subscribeSessions } from "@inkboard/shared/planner/sessions";

import { moveTasks, skipTasks, undoLast } from "@inkboard/shared/planner/storage";

import { usePlanner } from "@inkboard/shared/planner/use-planner";

import type { StudyPlan } from "@inkboard/shared/planner/types";

import { isApplyReady, weeklyApplyDiff } from "@inkboard/shared/planner/weekly-apply";

export default function AnalyticsPage() {
  const { plan, state } = usePlanner();
  const today = todayKey();
  const hour12 = readProfile().hour12;
  const [rangeId, setRangeId] = useState<"7d" | "30d" | "90d">("30d");
  const range = rangeBounds(rangeId, today);
  const prev = previousPeriod(range.from, range.to);
  const sessions = useSyncExternalStore(subscribeSessions, liveSessions, getServerSessions);
  const report = useMemo(
    () =>
      analyticsFor({
        plan,
        days: state.days,
        rows: allHistoryRows(plan, sessions),
        range,
        prev,
        today,
      }),
    [plan, state.days, sessions, range, prev, today],
  );
  const insight = useMemo(() => {
    if (report.bestHour != null) {
      const start = formatClock(report.bestHour * 60, hour12);
      const end = formatClock((report.bestHour + 2) * 60, hour12);
      return `You study best ${start}–${end}.`;
    }
    const weak = [...report.subjectSplit].sort((a, b) => a.minutes - b.minutes)[0];
    if (weak && report.subjectSplit.length > 1 && weak.minutes < (report.subjectSplit[0]?.minutes ?? 0) / 2) {
      return `${weak.label} is falling behind.`;
    }
    if (report.revision.overdue > 0) {
      return `${report.revision.overdue} revision${report.revision.overdue === 1 ? "" : "s"} overdue.`;
    }
    return "Keep the current pace.";
  }, [report, hour12]);
  const splitMax = Math.max(1, ...report.subjectSplit.map((s) => s.minutes));

  return (
    <div className="max-w-[65ch] py-8">
      <p className="text-seal text-faint">Instruments</p>
      <h1 className="chalk-draw mt-2 font-serif text-display">{insight}</h1>
      <p className="mt-2 text-sm tabular text-muted">
        {report.minutes} min this range · {report.minutesDelta >= 0 ? "+" : ""}
        {report.minutesDelta} vs previous · {Math.round(report.completionRate * 100)}% struck
      </p>
      <div className="mt-4">
        <SegmentedControl
          ariaLabel="Range"
          value={rangeId}
          onChange={setRangeId}
          options={[
            { id: "7d", label: "7d" },
            { id: "30d", label: "30d" },
            { id: "90d", label: "90d" },
          ]}
        />
      </div>

      <section className="mt-8">
        <p className="text-sm text-muted">
          {report.weeklyReview.hours}h · {report.weeklyReview.done}/{report.weeklyReview.planned} tasks
          {report.weeklyReview.bestDay ? ` · best ${formatDay(report.weeklyReview.bestDay)}` : ""}
        </p>
        <p className="mt-2 text-sm">{report.weeklyReview.suggestion}</p>
        {plan ? <WeeklyApplyButton plan={plan} suggestion={report.weeklyReview.suggestion} today={today} /> : null}
      </section>

      <section className="mt-10">
        <p className="text-seal text-faint">Minutes</p>
        <div className="mt-4">
          <LineChart
            values={report.minutesPerDay.map((d) => d.minutes)}
            goal={report.minutesPerDay[0]?.goal}
            labels={report.minutesPerDay.map((d) => d.date)}
          />
        </div>
      </section>

      {report.subjectSplit.length ? (
        <section className="mt-10">
          <p className="text-seal text-faint">Subjects</p>
          <ul className="mt-3">
            {report.subjectSplit.map((s) => (
              <li key={s.label} className="split-hatch">
                <span className={`inline-grid size-6 place-items-center ${subjectHatchClassFor(s.label)} hatch-mark`} aria-hidden="true">
                  {subjectMark(s.label)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{s.label}</span>
                <span className="bar" style={{ width: `${Math.max(8, (s.minutes / splitMax) * 40)}%` }} aria-hidden="true" />
                <span className="tabular text-caption text-muted">{s.minutes}m</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.dayOfWeek.some((d) => d.minutes) ? (
        <section className="mt-10">
          <p className="text-seal text-faint">Weekday pattern</p>
          <ul className="mt-3">
            {report.dayOfWeek.map((d) => (
              <li key={d.day} className="split-hatch">
                <span className="w-10 text-sm">{d.day}</span>
                <span className="bar" style={{ width: `${Math.max(8, (d.minutes / Math.max(1, ...report.dayOfWeek.map((x) => x.minutes))) * 40)}%` }} aria-hidden="true" />
                <span className="tabular text-caption text-muted">{d.minutes}m</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.buckets.some((b) => b.count) ? (
        <section className="mt-10">
          <p className="text-seal text-faint">Session length</p>
          <ul className="mt-3">
            {report.buckets.map((b) => (
              <li key={b.label} className="split-hatch">
                <span className="w-14 text-sm tabular">{b.label}</span>
                <span className="bar" style={{ width: `${Math.max(8, (b.count / Math.max(1, ...report.buckets.map((x) => x.count))) * 40)}%` }} aria-hidden="true" />
                <span className="tabular text-caption text-muted">{b.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-caption tabular text-muted">
        Goal hit {Math.round(report.goalHitRate * 100)}% · late finishes {Math.round(report.procrastinationIndex * 100)}% ·
        lectures {report.lecturesDone}/{report.lecturesPlanned}
      </p>

      {plan ? (
        <div className="mt-10">
          <a href="#revision-health" className="text-caption text-muted hover:text-fg">
            Revision health
          </a>
          <div className="mt-4">
            <RevisionHealthPanel plan={plan} today={today} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WeeklyApplyButton({ plan, suggestion, today }: { plan: StudyPlan; suggestion: string; today: string }) {
  const apply = weeklyApplyDiff(plan, today, suggestion);
  if (!isApplyReady(apply)) return null;
  return (
    <button
      type="button"
      className="mt-3 h-11 text-sm font-semibold text-primary"
      onClick={() => {
        if (apply.kind === "skip-extra-lecture") skipTasks(plan.id, apply.taskIds);
        if (apply.kind === "move-revision-today") moveTasks(plan.id, apply.taskIds, today);
        toast.success(apply.label, { action: { label: "Undo", onClick: () => undoLast() } });
      }}
    >
      Apply
    </button>
  );
}
