import { TIME_SLOTS, WEEKDAYS, SPEEDS, DEFAULT_REVISION_INTERVALS, HARD_MAX_LECTURES } from "@inkboard/shared/planner/types";
import type { PaceId, PlannerPrefs, PlaybackSpeed, PlaylistMode, TimeSlot } from "@inkboard/shared/planner/types";
import { applyPace, isPastStart, PACE_CARDS, PLAYLIST_MODES, tomorrowKey } from "@inkboard/shared/planner/wizard";
import type { GenerateResult } from "@inkboard/shared/planner/types";
import { dailyPreviewCopy, requiredPaceCopy } from "@inkboard/shared/planner/wizard";
import { WizardSampleWeek } from "./wizard-preview.tsx";

export function WizardPrefs({
  prefs,
  onChange,
  preview,
  onBack,
  onNext,
  onDropPlaylist,
}: {
  prefs: PlannerPrefs;
  onChange: (next: PlannerPrefs) => void;
  preview: GenerateResult;
  onBack: () => void;
  onNext: () => void;
  onDropPlaylist: (courseId: string) => void;
}) {
  const past = isPastStart(prefs.startDate);
  const feas = preview.summary.feasibility;
  const overshoot = Boolean(prefs.examDate && preview.summary.fitsBeforeExam === false);

  function setPace(id: PaceId) {
    onChange(applyPace(prefs, id, id === "custom" ? prefs.lecturesPerDay : undefined));
  }

  return (
    <div className="mt-6 space-y-6">
      <fieldset>
        <legend className="text-seal text-faint">Pace</legend>
        <div className="mt-2">
          {PACE_CARDS.map((card) => {
            const on = prefs.pace === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setPace(card.id)}
                className={`sheet-row w-full ${on ? "text-primary" : ""}`}
              >
                <span>
                  <span className="block text-sm font-semibold">{card.label}</span>
                  <span className="block text-caption text-muted">{card.hint}</span>
                </span>
                {card.note ? (
                  <span className={`text-caption uppercase ${card.caution ? "text-warn" : "text-primary"}`}>
                    {card.note}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        {prefs.pace === "custom" ? (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-muted">Lectures per day</span>
            <button
              type="button"
              className="grid size-11 place-items-center text-muted"
              onClick={() => onChange(applyPace(prefs, "custom", prefs.lecturesPerDay - 1))}
              aria-label="Fewer lectures"
            >
              −
            </button>
            <span className="min-w-6 text-center text-sm font-semibold tabular">{prefs.lecturesPerDay}</span>
            <button
              type="button"
              className="grid size-11 place-items-center text-muted"
              onClick={() => onChange(applyPace(prefs, "custom", prefs.lecturesPerDay + 1))}
              aria-label="More lectures"
            >
              +
            </button>
            <span className="text-caption text-muted">max {HARD_MAX_LECTURES}</span>
          </div>
        ) : null}
      </fieldset>

      <label className="block text-seal text-faint">
        Start date
        <input
          type="date"
          value={prefs.startDate}
          onChange={(e) => onChange({ ...prefs, startDate: e.target.value })}
          className="sheet-field mt-1"
        />
      </label>
      {past ? (
        <p className="text-sm text-warn">
          That date is already over.{" "}
          <button
            type="button"
            className="font-medium text-primary"
            onClick={() => onChange({ ...prefs, startDate: tomorrowKey() })}
          >
            Start tomorrow
          </button>
        </p>
      ) : null}

      <label className="block text-seal text-faint">
        Exam date <span className="text-muted">(optional)</span>
        <input
          type="date"
          value={prefs.examDate ?? ""}
          onChange={(e) => onChange({ ...prefs, examDate: e.target.value || null })}
          className="sheet-field mt-1"
        />
      </label>
      {overshoot && feas && prefs.examDate ? (
        <div className="border-y border-line py-3">
          <p className="text-sm text-warn">{requiredPaceCopy(feas.requiredLecturesPerDay, prefs.examDate)}</p>
          <p className="mt-1 text-caption text-muted">Won’t silently pack more than {prefs.lecturesPerDay}/day.</p>
          <div className="mt-2 flex flex-wrap gap-4">
            {feas.raisePaceTo ? (
              <button
                type="button"
                className="h-11 text-sm text-primary"
                onClick={() =>
                  onChange(
                    applyPace(
                      prefs,
                      feas.raisePaceTo!,
                      feas.raisePaceTo === "custom"
                        ? Math.min(HARD_MAX_LECTURES, Math.ceil(feas.requiredLecturesPerDay))
                        : undefined,
                    ),
                  )
                }
              >
                Raise to {feas.raisePaceTo}
              </button>
            ) : null}
            {feas.extendExamDateBy > 0 ? (
              <button
                type="button"
                className="h-11 text-sm text-muted"
                onClick={() => onChange({ ...prefs, examDate: feas.finishDateAtCurrentPace })}
              >
                Extend exam to {feas.finishDateAtCurrentPace}
              </button>
            ) : null}
            {feas.dropPlaylistSuggestions.slice(0, 2).map((s) => (
              <button
                key={s.courseId}
                type="button"
                className="h-11 text-sm text-muted"
                onClick={() => onDropPlaylist(s.courseId)}
              >
                Drop {s.title}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-seal text-faint">Study days</legend>
        <div className="caption-toggle mt-2">
          {WEEKDAYS.map((d) => {
            const on = prefs.studyDays.includes(d.id);
            return (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...prefs,
                    studyDays: on ? prefs.studyDays.filter((x) => x !== d.id) : [...prefs.studyDays, d.id],
                  })
                }
                className={`caption-opt${on ? " is-on" : ""}`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-seal text-faint">Time of day</legend>
        <div className="mt-2">
          {TIME_SLOTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange({ ...prefs, timeSlot: s.id as TimeSlot })}
              className={`sheet-row w-full ${prefs.timeSlot === s.id ? "text-primary" : ""}`}
            >
              <span>
                <span className="block text-sm">{s.label}</span>
                <span className="block text-caption text-muted">{s.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {preview.summary.lessonCount > 0 ? (
        <div>
          <p className="font-serif text-h3">{dailyPreviewCopy(preview, prefs)}</p>
          <WizardSampleWeek tasks={preview.tasks} compact />
        </div>
      ) : null}

      <details>
        <summary className="cursor-pointer text-seal text-faint">Advanced</summary>
        <div className="mt-4 space-y-4">
          <label className="block text-sm">
            New-lecture cap · {prefs.maxNewMinutesPerDay} min
            <input
              type="range"
              min={30}
              max={300}
              step={10}
              value={prefs.maxNewMinutesPerDay}
              onChange={(e) => onChange({ ...prefs, maxNewMinutesPerDay: Number(e.target.value) })}
              className="mt-2 w-full"
            />
          </label>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.includeRevision}
              onChange={(e) => onChange({ ...prefs, includeRevision: e.target.checked })}
            />
            Spaced revision
          </label>
          {prefs.includeRevision ? (
            <div className="caption-toggle">
              {DEFAULT_REVISION_INTERVALS.map((n) => {
                const on = prefs.revisionIntervals.includes(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...prefs,
                        revisionIntervals: on
                          ? prefs.revisionIntervals.filter((x) => x !== n)
                          : [...prefs.revisionIntervals, n].sort((a, b) => a - b),
                      })
                    }
                    className={`caption-opt${on ? " is-on" : ""}`}
                  >
                    +{n}d
                  </button>
                );
              })}
            </div>
          ) : null}
          <fieldset>
            <legend className="text-seal text-faint">How courses mix</legend>
            <div className="mt-2">
              {PLAYLIST_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...prefs,
                      playlistMode: m.id as PlaylistMode,
                      mixMode: m.id === "rotate" ? "mix" : "one-subject",
                    })
                  }
                  className={`sheet-row w-full ${prefs.playlistMode === m.id ? "text-primary" : ""}`}
                >
                  <span>
                    <span className="block text-sm">{m.label}</span>
                    <span className="block text-caption text-muted">{m.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.restEvery > 0}
              onChange={(e) => onChange({ ...prefs, restEvery: e.target.checked ? 6 : 0 })}
            />
            Light day after {prefs.restEvery || 6} study days
          </label>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={prefs.includeDpp}
              onChange={(e) => onChange({ ...prefs, includeDpp: e.target.checked })}
            />
            Auto-add DPP when a class has a PDF
          </label>
          <label className="block text-seal text-faint">
            Catch-up day (weekly recap)
            <select
              value={prefs.catchUpDay ?? ""}
              onChange={(e) => onChange({ ...prefs, catchUpDay: e.target.value === "" ? null : Number(e.target.value) })}
              className="sheet-field mt-1"
            >
              <option value="">None</option>
              {WEEKDAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-seal text-faint">Playback speed</legend>
            <div className="caption-toggle mt-2">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ ...prefs, speed: s as PlaybackSpeed })}
                  className={`caption-opt${prefs.speed === s ? " is-on" : ""}`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </details>

      <div className="flex justify-between">
        <button type="button" className="h-11 text-sm text-muted" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="h-11 text-sm font-semibold text-primary"
        >
          Preview
        </button>
      </div>
    </div>
  );
}
