import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/planner/confirm-dialog.tsx";
import { Dialog, Select, Switch } from "@/components/ui/kit";
import { MilestoneForm } from "@/components/planner/settings-milestone.tsx";
import { ThemeToggle } from "@/components/theme-toggle.tsx";
import { COPY } from "@inkboard/shared/copy";
import { backupSummary, dryRunImport, exportPlannerJson, formatBytes, importPlannerBackup, plannerStorageBytes } from "@inkboard/shared/planner/backup";
import { applyComfort } from "@inkboard/shared/planner/comfort";
import { formatClock } from "@inkboard/shared/planner/daily";
import { describeDiff, previewRebuild } from "@inkboard/shared/planner/scheduler";
import { PACE_CARDS } from "@inkboard/shared/planner/wizard";
import { DEFAULT_PROFILE, readProfile, writeProfile, type MilestoneGoal } from "@inkboard/shared/planner/profile";
import { uid } from "@inkboard/shared/planner/ids";
import {
  createRecoveryPoint,
  listRecoveryPoints,
  restoreRecoveryPoint,
} from "@inkboard/shared/planner/recovery";
import { reminderSupported, requestReminderPermission } from "@inkboard/shared/planner/reminders";
import {
  deletePlan,
  patchPlan,
  readPlanner,
  replacePlanTasks,
  resetPlannerWorkspace,
  snapshotUndo,
  undoLast,
} from "@inkboard/shared/planner/storage";
import { WEEKDAYS, type PlanDiff, type PlanTask, type PlannerPrefs } from "@inkboard/shared/planner/types";
import { usePlanner } from "@inkboard/shared/planner/use-planner";
import { loadCourseDetail } from "@/lib/unacademy";
import { publishFormLedger } from "@inkboard/shared/planner/instruments";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function hourLabel(h: number, hour12 = true) {
  return formatClock(h * 60, hour12);
}

function syncCopy(sync: string, lastSyncedAt: string | null) {
  if (sync === "local-only") return "Saved on this device only (sign-in is off).";
  if (sync === "syncing") return "Syncing…";
  if (sync === "offline") return "Offline — changes stay here until you're back online.";
  if (sync === "error") return "Not synced. Retry from this page.";
  if (lastSyncedAt) return `Last synced ${new Date(lastSyncedAt).toLocaleString()}`;
  return "Synced.";
}

export function PlannerSettingsPage() {
  const { plan, state, sync, retrySync, lastSyncedAt } = usePlanner();
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  useEffect(() => {
    setProfile(readProfile());
  }, []);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetTyped, setResetTyped] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rebuildPreview, setRebuildPreview] = useState<{ tasks: PlanTask[]; diff: PlanDiff } | null>(null);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [importPreview, setImportPreview] = useState<{ raw: string; summary: ReturnType<typeof dryRunImport> } | null>(
    null,
  );
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const [points, setPoints] = useState(listRecoveryPoints);
  const [storageBytes, setStorageBytes] = useState(0);
  const [saved, setSaved] = useState(false);
  const summary = useMemo(() => backupSummary(state), [state]);
  useEffect(() => {
    setStorageBytes(plannerStorageBytes());
  }, [state]);

  useEffect(() => {
    publishFormLedger({
      kicker: "Settings",
      title: "Settings",
      lines: [
        syncCopy(sync, lastSyncedAt ?? null),
        plan ? plan.name : "No plan",
        `${summary.plans} plans · ${summary.tasks} tasks`,
      ],
    });
    return () => publishFormLedger(null);
  }, [sync, lastSyncedAt, plan, summary.plans, summary.tasks]);

  function saveProfile(over: Partial<typeof profile>) {
    const next = writeProfile(over);
    setProfile(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
    return next;
  }

  async function previewRemaining() {
    if (!plan) return;
    setRebuildBusy(true);
    try {
      const date = plan.prefs.startDate;
      const fresh = await Promise.all(
        plan.courses.map(async (c) => {
          try {
            const detail = await loadCourseDetail({ data: { uid: c.courseId, teacher: c.teacherUsername } });
            return {
              ...c,
              lessons: detail.lessons.map((l) => ({
                lessonId: l.replayId || l.uid,
                title: l.title,
                durationSec: l.durationSec,
                rank: l.rank,
                week: l.week,
                notesUrl: l.notesUrl,
                dppUrl: l.dppUrl,
                playable: l.playable,
                status: l.status,
              })),
            };
          } catch {
            return c;
          }
        }),
      );
      const { tasks, diff } = previewRebuild(plan.tasks, plan.prefs, fresh, date);
      setRebuildPreview({ tasks, diff });
    } finally {
      setRebuildBusy(false);
    }
  }

  function applyRemaining() {
    if (!plan || !rebuildPreview) return;
    if (!createRecoveryPoint("rebuild remaining", readPlanner())) {
      toast.error(`${COPY.recoveryMarkFail} Export a backup first.`);
      return;
    }
    snapshotUndo();
    replacePlanTasks(plan.id, rebuildPreview.tasks, rebuildPreview.tasks[rebuildPreview.tasks.length - 1]?.date ?? plan.endDate);
    toast.success(describeDiff(rebuildPreview.diff), { action: { label: "Undo", onClick: () => undoLast() } });
    setRebuildPreview(null);
  }

  return (
    <div className="max-w-[65ch] py-8">
      <p className="text-seal text-faint">Planner</p>
      <h1 className="mt-2 text-2xl font-medium">Settings</h1>
      <p className="mt-2 text-sm text-muted">
        Profile, pace, backups, and recovery. Dates are this device’s local calendar (India-first).
        {saved ? (
          <span className="ml-2 text-primary" role="status">
            Saved
          </span>
        ) : null}
      </p>
      <p className="mt-3 text-xs text-faint">
        Class videos, slides, and notes are fetched from Unacademy for personal study. Inkboard is not affiliated with Unacademy.
      </p>

        <section className="mt-10">
          <p className="text-seal text-faint">Profile</p>
          <label className="mt-3 block text-seal text-faint">
            Name
            <input
              value={profile.name}
              onChange={(e) => saveProfile({ name: e.target.value })}
              className="sheet-field mt-1"
            />
          </label>
          <div className="caption-toggle mt-3">
            <button
              type="button"
              className={`caption-opt${profile.streakMode === "any" ? " is-on" : ""}`}
              onClick={() => saveProfile({ streakMode: "any" })}
            >
              Streak: any study
            </button>
            <button
              type="button"
              className={`caption-opt${profile.streakMode === "goal" ? " is-on" : ""}`}
              onClick={() => saveProfile({ streakMode: "goal" })}
            >
              Streak: hit daily goal
            </button>
            <button
              type="button"
              className={`caption-opt${profile.dailyGoalMode === "minutes" ? " is-on" : ""}`}
              onClick={() => saveProfile({ dailyGoalMode: "minutes" })}
            >
              Daily goal: minutes
            </button>
            <button
              type="button"
              className={`caption-opt${profile.dailyGoalMode === "lectures" ? " is-on" : ""}`}
              onClick={() => saveProfile({ dailyGoalMode: "lectures" })}
            >
              Daily goal: lectures
            </button>
          </div>
          <label className="mt-3 block text-xs text-muted">
            Weekly minutes goal
            <input
              type="number"
              min={30}
              max={4000}
              value={profile.weeklyMinutes}
              onChange={(e) => saveProfile({ weeklyMinutes: Number(e.target.value) || DEFAULT_PROFILE.weeklyMinutes })}
              className="sheet-field mt-1"
            />
          </label>
          <div className="mt-4">
            <p className="text-xs text-muted">Subject milestones (“finish Physics by …”) show on the dashboard.</p>
            <ul className="mt-2 space-y-2">
              {profile.milestones.map((m) => (
                <li key={m.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {m.subject} by {m.by}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-danger"
                    onClick={() => saveProfile({ milestones: profile.milestones.filter((x) => x.id !== m.id) })}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <MilestoneForm
              onAdd={(m) => saveProfile({ milestones: [...profile.milestones, m] })}
            />
          </div>
        </section>

        <section className="mt-10">
          <p className="text-seal text-faint">Appearance</p>
          <p className="mt-1 text-xs text-muted">Dark, light, or match this device. Saved on this browser.</p>
          <div className="mt-3">
            <ThemeToggle />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {([100, 112, 125] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={`caption-opt${profile.fontScale === n ? " is-on" : ""}`}
                onClick={() => {
                  const next = saveProfile({ fontScale: n });
                  applyComfort(next);
                }}
              >
                Text {n}%
              </button>
            ))}
          </div>
          <label className="mt-3 flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.reduceMotion}
              onChange={(e) => applyComfort(saveProfile({ reduceMotion: e.target.checked }))}
            />
            Reduce motion
          </label>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.highContrast}
              onChange={(e) => applyComfort(saveProfile({ highContrast: e.target.checked }))}
            />
            High contrast
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Select
              label="Week starts"
              value={String(profile.weekStartsOn)}
              onChange={(value) => saveProfile({ weekStartsOn: value === "0" ? 0 : 1 })}
              options={[
                { value: "1", label: "Monday" },
                { value: "0", label: "Sunday" },
              ]}
            />
            <Switch
              checked={profile.hour12}
              label="12-hour clock"
              onCheckedChange={(on) => saveProfile({ hour12: on })}
            />
          </div>
        </section>

        {plan ? (
          <section className="mt-10">
            <p className="text-seal text-faint">Active plan · {plan.name}</p>
            <label className="mt-3 block text-xs text-muted">
              Name
              <input
                defaultValue={plan.name}
                onBlur={(e) => patchPlan(plan.id, { name: e.target.value })}
                className="sheet-field mt-1"
              />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {PACE_CARDS.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`sheet-row w-full ${plan.prefs.pace === card.id ? "text-primary" : ""}`}
                  onClick={() =>
                    patchPlan(plan.id, {
                      prefs: { ...plan.prefs, pace: card.id, lecturesPerDay: card.lectures } as PlannerPrefs,
                    })
                  }
                >
                  <span className="font-semibold">{card.label}</span>
                  <span className="mt-0.5 block text-muted">{card.hint}</span>
                </button>
              ))}
            </div>
            <label className="mt-3 block text-xs text-muted">
              Daily minutes
              <input
                type="number"
                defaultValue={plan.prefs.dailyMinutes}
                onBlur={(e) =>
                  patchPlan(plan.id, {
                    prefs: { ...plan.prefs, dailyMinutes: Number(e.target.value) || plan.prefs.dailyMinutes },
                  })
                }
                className="sheet-field mt-1"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`caption-opt${plan.prefs.studyDays.includes(d.id) ? " is-on" : ""}`}
                  onClick={() => {
                    const has = plan.prefs.studyDays.includes(d.id);
                    const studyDays = has ? plan.prefs.studyDays.filter((x) => x !== d.id) : [...plan.prefs.studyDays, d.id];
                    patchPlan(plan.id, { prefs: { ...plan.prefs, studyDays } });
                  }}
                >
                  {d.short}
                </button>
              ))}
            </div>
            {reminderSupported() ? (
              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={plan.prefs.reminders}
                    onChange={async (e) => {
                      if (e.target.checked) await requestReminderPermission();
                      patchPlan(plan.id, { prefs: { ...plan.prefs, reminders: e.target.checked } });
                    }}
                  />
                  Daily reminder (asks permission only when you turn this on)
                </label>
                {plan.prefs.reminders ? (
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="text-xs text-muted">
                      Time
                      <select
                        value={plan.prefs.reminderHour ?? 19}
                        onChange={(e) =>
                          patchPlan(plan.id, { prefs: { ...plan.prefs, reminderHour: Number(e.target.value) } })
                        }
                        className="sheet-field mt-1"
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {hourLabel(h, profile.hour12)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted">
                      Quiet from
                      <select
                        value={plan.prefs.quietStart ?? 22}
                        onChange={(e) =>
                          patchPlan(plan.id, { prefs: { ...plan.prefs, quietStart: Number(e.target.value) } })
                        }
                        className="sheet-field mt-1"
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {hourLabel(h, profile.hour12)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-muted">
                      Quiet until
                      <select
                        value={plan.prefs.quietEnd ?? 7}
                        onChange={(e) =>
                          patchPlan(plan.id, { prefs: { ...plan.prefs, quietEnd: Number(e.target.value) } })
                        }
                        className="sheet-field mt-1"
                      >
                        {HOURS.map((h) => (
                          <option key={h} value={h}>
                            {hourLabel(h, profile.hour12)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={rebuildBusy}
                className="h-11 text-sm text-muted disabled:opacity-50"
                onClick={() => void previewRemaining()}
              >
                {rebuildBusy ? "Checking remaining…" : "Apply to remaining tasks"}
              </button>
              <button type="button" className="h-11 text-sm text-danger" onClick={() => setConfirmDelete(true)}>
                Delete plan
              </button>
            </div>
          </section>
        ) : (
          <div className="mt-8">
            <p className="font-serif text-h3">No plan yet.</p>
            <p className="mt-1 text-sm text-muted">Pace and backups show up after you make a plan.</p>
            <Link to="/planner/new" className="mt-3 inline-flex h-11 items-center text-sm font-semibold text-primary">
              Lay out a plan
            </Link>
          </div>
        )}

        <section className="mt-10">
          <p className="text-seal text-faint">Data</p>
          <p className="mt-1 text-xs text-muted">
            {syncCopy(sync, lastSyncedAt ?? null)} · {summary.plans} plans · {summary.tasks} tasks · {formatBytes(storageBytes)} on this device
          </p>
          {sync === "error" ? (
            <button type="button" className="mt-2 text-xs text-primary" onClick={() => void retrySync()}>
              Retry sync
            </button>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="h-11 text-sm text-muted"
              onClick={() => {
                const blob = new Blob([exportPlannerJson()], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "inkboard-planner.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export JSON
            </button>
            <label className="inline-flex h-11 cursor-pointer items-center text-sm text-muted">
              Import JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const raw = await file.text();
                    setImportPreview({ raw, summary: dryRunImport(raw) });
                  } catch {
                    toast.error("That file isn’t a valid Inkboard backup.");
                  }
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              className="h-11 text-sm text-muted"
              onClick={() => {
                if (!createRecoveryPoint("manual", readPlanner())) {
                  toast.error(COPY.recoveryMarkFail);
                  return;
                }
                setPoints(listRecoveryPoints());
                toast.success("Recovery point saved");
              }}
            >
              Create recovery point
            </button>
            <button type="button" className="h-11 text-sm text-danger" onClick={() => setConfirmReset(true)}>
              Reset workspace
            </button>
          </div>
          <ul className="mt-4 space-y-2">
            {points.length ? (
              points.map((p) => (
                <li key={p.id} className="sheet-row text-caption">
                  <span>
                    {p.reason} · {new Date(p.at).toLocaleString()} · {p.planCount} plans / {p.taskCount} tasks
                  </span>
                  <button
                    type="button"
                    className="h-11 text-sm text-primary"
                    onClick={() => {
                      if (restoreRecoveryPoint(p.id)) {
                        setPoints(listRecoveryPoints());
                        toast.success("Restored");
                      }
                      else toast.error("Restore failed");
                    }}
                  >
                    Restore
                  </button>
                </li>
              ))
            ) : (
              <li className="text-xs text-muted">No recovery points yet. One is created before rebuild, import, delete, or reset.</li>
            )}
          </ul>
        </section>

      {rebuildPreview ? (
        <Dialog title="Apply to remaining tasks?" onClose={() => setRebuildPreview(null)}>
          <p className="mt-1 text-sm text-muted">{describeDiff(rebuildPreview.diff)} Completed classes stay put.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="h-11 text-sm text-muted" onClick={() => setRebuildPreview(null)}>
              Cancel
            </button>
            <button type="button" className="h-11 text-sm font-semibold text-primary" onClick={applyRemaining}>
              Apply
            </button>
          </div>
        </Dialog>
      ) : null}

      {importPreview ? (
        <Dialog title="Import backup" onClose={() => setImportPreview(null)}>
          <p className="mt-1 text-sm text-muted">
            {importPreview.summary.plans} plans · {importPreview.summary.tasks} tasks · {importPreview.summary.name}
          </p>
          <div className="mt-3 flex gap-2 text-xs">
            <button
              type="button"
              className={`caption-opt${importMode === "merge" ? " is-on" : ""}`}
              onClick={() => setImportMode("merge")}
            >
              Merge
            </button>
            <button
              type="button"
              className={`caption-opt${importMode === "replace" ? " is-on" : ""}`}
              onClick={() => setImportMode("replace")}
            >
              Replace
            </button>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="h-11 text-sm text-muted" onClick={() => setImportPreview(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="h-11 text-sm font-semibold text-primary"
              onClick={() => {
                try {
                  importPlannerBackup(importPreview.raw, importMode);
                  toast.success("Imported", { action: { label: "Undo", onClick: () => undoLast() } });
                  setImportPreview(null);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Import failed");
                }
              }}
            >
              Confirm
            </button>
          </div>
        </Dialog>
      ) : null}

      <ConfirmDialog
        open={confirmDelete && Boolean(plan)}
        title="Delete this plan?"
        body="A recovery point is saved first. You can restore it from this page."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          if (!plan) return;
          if (!createRecoveryPoint("delete plan", readPlanner())) {
            toast.error(COPY.recoveryMarkFail);
            return;
          }
          snapshotUndo();
          deletePlan(plan.id);
          setConfirmDelete(false);
          toast.success("Plan deleted", { action: { label: "Undo", onClick: () => undoLast() } });
        }}
      />

      {confirmReset ? (
        <Dialog title="Delete all planner data?" onClose={() => { setConfirmReset(false); setResetTyped(""); }}>
          <p className="mt-1 text-sm text-muted">Type DELETE to confirm. A recovery point is saved first.</p>
          <input
            value={resetTyped}
            onChange={(e) => setResetTyped(e.target.value)}
            className="sheet-field mt-3"
            placeholder="DELETE"
            aria-label="Type DELETE to confirm"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="h-11 text-sm text-muted"
              onClick={() => {
                setConfirmReset(false);
                setResetTyped("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={resetTyped !== "DELETE"}
              className="h-11 text-sm font-semibold text-danger disabled:opacity-40"
              onClick={() => {
                if (resetTyped !== "DELETE") return;
                if (!createRecoveryPoint("reset workspace", readPlanner())) {
                  toast.error(`${COPY.recoveryMarkFail} Export a backup first.`);
                  return;
                }
                resetPlannerWorkspace();
                setConfirmReset(false);
                setResetTyped("");
                toast.success("Workspace reset");
              }}
            >
              Delete all
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}


