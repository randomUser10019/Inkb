import { useEffect, useMemo, type ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { todayKey } from "@inkboard/shared/planner/dates";
import { maybeNotify } from "@inkboard/shared/planner/reminders";
import { PlannerSyncContext } from "@inkboard/shared/planner/sync-context";
import { computeStreaks } from "@inkboard/shared/planner/streaks";
import {
  activePlan,
  getServerPlanner,
  mergeFreezeWeeks,
  readPlanner,
  subscribePlanner,
  todaysTasks,
} from "@inkboard/shared/planner/storage";

export function PlannerSyncProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(subscribePlanner, readPlanner, getServerPlanner);
  const plan = activePlan(state);
  const today = todaysTasks(state);
  const streak = computeStreaks(
    state.days,
    plan?.tasks ?? [],
    state.freezeWeeks,
    todayKey(),
    plan?.prefs.streakMinutes ?? 20,
    plan?.prefs,
  );
  const pendingToday = today.filter((t) => t.status === "pending").length;
  const freezeKey = (streak.consumedWeeks ?? []).join(",");

  useEffect(() => {
    const missing = freezeKey.split(",").filter((w) => w && !state.freezeWeeks.includes(w));
    if (!missing.length) return;
    mergeFreezeWeeks(missing);
  }, [freezeKey, state.freezeWeeks]);

  useEffect(() => {
    if (!plan) return;
    maybeNotify(plan.prefs, today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id, pendingToday, plan?.prefs.reminders, plan?.prefs.timeSlot]);

  const value = useMemo(
    () => ({ sync: "local-only" as const, retrySync: () => undefined, lastSyncedAt: null }),
    [],
  );

  return <PlannerSyncContext.Provider value={value}>{children}</PlannerSyncContext.Provider>;
}
