import type { GenerateResult, PlannerPrefs, PlanTask } from "@inkboard/shared/planner/types";
import { slotCopy } from "@inkboard/shared/planner/scheduler";
import { dailyPreviewCopy, sampleDays } from "@inkboard/shared/planner/wizard";
import { StatusPanel } from "@/components/skeleton";

export function WizardSampleWeek({ tasks, compact }: { tasks: PlanTask[]; compact?: boolean }) {
  const days = sampleDays(tasks, 7);
  if (!days.length) return null;
  return (
    <ol className={`mt-3 ${compact ? "space-y-2" : "space-y-3"}`}>
      {days.map((d) => (
        <li key={d.date} className="border-t border-line pt-2">
          <p className="text-seal text-faint">{d.label}</p>
          <ul className="mt-1">
            {d.items.slice(0, compact ? 3 : 5).map((item, i) => (
              <li key={`${d.date}-${i}`} className="truncate py-0.5 text-sm">
                {item.title}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function WizardPreview({
  preview,
  prefs,
  onBack,
  onCreate,
}: {
  preview: GenerateResult;
  prefs: PlannerPrefs;
  onBack: () => void;
  onCreate: () => void;
}) {
  if (preview.summary.lessonCount === 0) {
    return (
      <div className="mt-6">
        <StatusPanel
          tone="empty"
          title="Nothing to schedule"
          body={preview.summary.warning ?? "Pick courses that already have replays."}
        />
        <button type="button" className="mt-4 h-10 px-3 text-sm text-muted" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <p className="font-serif text-h3">{dailyPreviewCopy(preview, prefs)}</p>
      <p className="mt-2 text-sm text-muted">
        {preview.summary.lessonCount} lessons
        {preview.summary.revisionCount ? ` · ${preview.summary.revisionCount} revision sessions` : ""}
        {" · "}
        {preview.summary.totalHours}h
        {preview.summary.examDate
          ? preview.summary.fitsBeforeExam
            ? " · fits before the exam"
            : ` · overshoots · ${preview.summary.warning ?? ""}`
          : null}
        {" · "}
        {slotCopy(prefs.timeSlot)}
      </p>
      <WizardSampleWeek tasks={preview.tasks} />
      <div className="mt-6 flex justify-between">
        <button type="button" className="h-11 text-sm text-muted" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          disabled={!preview.tasks.length}
          onClick={onCreate}
          className="h-11 text-sm font-semibold text-primary disabled:opacity-50"
        >
          Create plan
        </button>
      </div>
    </div>
  );
}
