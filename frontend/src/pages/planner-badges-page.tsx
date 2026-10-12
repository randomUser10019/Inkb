import { useMemo, useState, useSyncExternalStore } from "react";

import { KitSelect, SegmentedControl } from "@/components/ui/planner/kit.tsx";

import { AppErrorComponent } from "@/lib/error-component";

import { evaluateBadges, getServerBadges, readEarnedBadges, subscribeBadges, withEarnedDates, type BadgeCategory, type BadgeProgress } from "@inkboard/shared/planner/badges";

import { todayKey } from "@inkboard/shared/planner/dates";

import { getServerJournal, readJournal, subscribeJournal } from "@inkboard/shared/planner/journal";

import { getServerSessions, liveSessions, subscribeSessions } from "@inkboard/shared/planner/sessions";

import { comebackCount, isCaughtUp } from "@inkboard/shared/planner/streaks";

import { usePlanner } from "@inkboard/shared/planner/use-planner";

const CATS: BadgeCategory[] = ["Consistency", "Lectures", "Time", "Revision", "Reflection", "Comeback"];

export default function BadgesPage() {
  const { state, plan, streak } = usePlanner();
  const date = todayKey();
  const [status, setStatus] = useState<"all" | "earned" | "locked">("all");
  const [cat, setCat] = useState<BadgeCategory | "">("");
  const sessions = useSyncExternalStore(subscribeSessions, liveSessions, getServerSessions);
  const journal = useSyncExternalStore(subscribeJournal, readJournal, getServerJournal);
  const earnedRows = useSyncExternalStore(subscribeBadges, readEarnedBadges, getServerBadges);
  const list = useMemo(() => {
    const progress = withEarnedDates(
      evaluateBadges({
        state,
        plan,
        streak,
        sessions,
        journal,
        comebacks: comebackCount(state.days, plan?.tasks ?? [], date, plan?.prefs.streakMinutes ?? 20, plan?.prefs),
        caughtUp: plan ? isCaughtUp(plan.tasks, date) : false,
      }),
      earnedRows,
    );
    return progress.filter((b) => {
      if (status === "earned" && !b.earned) return false;
      if (status === "locked" && b.earned) return false;
      if (cat && b.category !== cat) return false;
      return true;
    });
  }, [state, plan, streak, date, status, cat, sessions, journal, earnedRows]);
  const earned = list.filter((b) => b.earned).length;
  const todayEarned = list.filter((b) => b.earnedAt?.startsWith(date));

  return (
    <div className="py-8">
      <p className="text-seal text-faint">Seals</p>
      <h1 className="chalk-draw mt-2 font-serif text-display">Stamp sheet</h1>
      <p className="mt-2 text-sm tabular text-muted">
        {earned} earned · {list.filter((b) => !b.earned).length} empty
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <SegmentedControl
          ariaLabel="Seal status"
          value={status}
          onChange={setStatus}
          options={[
            { id: "all", label: "All" },
            { id: "earned", label: "Earned" },
            { id: "locked", label: "Empty" },
          ]}
        />
        <KitSelect
          value={cat}
          onChange={(v) => setCat(v as BadgeCategory | "")}
          ariaLabel="Seal category"
          options={[{ id: "", label: "All categories" }, ...CATS.map((c) => ({ id: c, label: c }))]}
        />
      </div>
      {CATS.filter((c) => list.some((b) => b.category === c)).map((c) => {
        const group = list.filter((b) => b.category === c);
        const got = group.filter((b) => b.earned).length;
        return (
          <section key={c} className="mt-10">
            <p className="text-seal text-faint">
              {c} · {got}/{group.length}
            </p>
            <ul className="seal-sheet mt-4">
              {group.map((b) => (
                <SealCard key={b.id} badge={b} today={todayEarned.some((x) => x.id === b.id)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function SealCard({ badge, today }: { badge: BadgeProgress; today: boolean }) {
  const cls = `seal${badge.earned ? " is-earned" : " is-empty"}${today ? " is-today" : ""}`;
  return (
    <li className={cls}>
      <p className="seal-title">{badge.title}</p>
      <p className="seal-meta">{badge.tier}</p>
      <p className="mt-2 text-xs leading-snug text-muted">{badge.earned ? badge.earnedAt?.slice(0, 10) ?? "Earned" : badge.criteria}</p>
    </li>
  );
}
