import { useMemo, useState, useSyncExternalStore } from "react";

import { toast } from "sonner";

import { StrikeTitle } from "@/components/folio/shelf.tsx";

import { SegmentedControl } from "@/components/ui/planner/kit.tsx";

import { AppErrorComponent } from "@/lib/error-component";

import { addDaysKey, formatDay, todayKey } from "@inkboard/shared/planner/dates";

import { addJournalGoal, emptyEntry, entryFor, getServerJournal, readJournal, subscribeJournal, toggleJournalGoal, upsertJournal } from "@inkboard/shared/planner/journal";

import { addCustomTask } from "@inkboard/shared/planner/storage";

import { usePlanner } from "@inkboard/shared/planner/use-planner";

const MOOD = [
  { n: 1, label: "Rough" },
  { n: 2, label: "Low" },
  { n: 3, label: "Okay" },
  { n: 4, label: "Good" },
  { n: 5, label: "Great" },
] as const;

const FOCUS = [
  { n: 1, label: "Foggy" },
  { n: 2, label: "Drift" },
  { n: 3, label: "Steady" },
  { n: 4, label: "Sharp" },
  { n: 5, label: "Flow" },
] as const;

export default function JournalPage() {
  const { plan } = usePlanner();
  const entries = useSyncExternalStore(subscribeJournal, readJournal, getServerJournal);
  const [date, setDate] = useState(todayKey);
  const entry = entryFor(date, entries) ?? emptyEntry(date);
  const dots = useMemo(() => new Set(entries.filter((e) => e.summary.trim() || e.wentWell.trim()).map((e) => e.date)), [entries]);
  const written = Boolean(entry.summary.trim() || entry.wentWell.trim());
  const streak = useMemo(() => {
    let n = 0;
    let d = todayKey();
    while (dots.has(d)) {
      n += 1;
      d = addDaysKey(d, -1);
    }
    return n;
  }, [dots]);

  function save(over: Partial<typeof entry>) {
    upsertJournal({ ...entry, ...over, date });
  }

  return (
    <div className="journal-paper py-8">
      <p className="folio-num text-seal">Folio {date.slice(8)} · {formatDay(date, "MMMM yyyy")}</p>
      <h1 className="chalk-draw mt-2 font-serif text-display">{formatDay(date, "EEEE d MMMM")}</h1>
      <p className="mt-2 text-sm text-muted">{streak ? `${streak}-day reflection` : written ? "A few lines is enough." : "Nothing written."}</p>
      <div className="mt-4">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-11 border-0 border-b border-line bg-transparent text-sm"
          aria-label="Journal date"
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-1">
        {Array.from({ length: 14 }, (_, i) => addDaysKey(todayKey(), i - 13)).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDate(d)}
            className={`grid size-11 place-items-center text-xs tabular ${d === date ? "text-primary" : "text-muted"}`}
            aria-label={`${formatDay(d)}${dots.has(d) ? ", journal written" : ""}`}
          >
            {d.slice(8)}
            {dots.has(d) ? <span className="mt-0.5 block size-1 bg-fg" /> : null}
          </button>
        ))}
      </div>
      <div className="mt-8 space-y-6">
        <Scale label="Mood" value={entry.mood} onChange={(mood) => save({ mood })} options={MOOD} />
        <Scale label="Focus" value={entry.focus} onChange={(focus) => save({ focus })} options={FOCUS} />
        <Field label="Summary" value={entry.summary} onChange={(summary) => save({ summary })} />
        <Field label="What went well" value={entry.wentWell} onChange={(wentWell) => save({ wentWell })} />
        <Field label="What didn’t" value={entry.wentWrong} onChange={(wentWrong) => save({ wentWrong })} />
        <Field label="Tomorrow’s plan" value={entry.tomorrow} onChange={(tomorrow) => save({ tomorrow })} />
        {plan && entry.tomorrow.trim() ? (
          <button
            type="button"
            className="h-11 text-sm text-primary"
            onClick={() => {
              addCustomTask(plan.id, { title: entry.tomorrow.trim(), date: addDaysKey(date, 1), durationMin: 20, type: "custom" });
              toast.success("Added as tomorrow’s task");
            }}
          >
            Write it on tomorrow’s board
          </button>
        ) : null}
        <div>
          <p className="text-seal text-faint">Small goals</p>
          <ul className="mt-2">
            {entry.goals.map((g) => (
              <li key={g.id} className="border-b border-line">
                <label className="flex h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={g.done} onChange={() => toggleJournalGoal(date, g.id)} />
                  <StrikeTitle done={g.done} className="text-sm">
                    {g.text}
                  </StrikeTitle>
                </label>
              </li>
            ))}
          </ul>
          <form
            className="mt-2 flex gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const text = String(fd.get("g") || "").trim();
              if (text) addJournalGoal(date, text);
              e.currentTarget.reset();
            }}
          >
            <input name="g" placeholder="Add a goal" className="h-11 flex-1 border-0 border-b border-line bg-transparent px-0 font-serif text-sm" />
            <button type="submit" className="h-11 text-sm font-semibold text-primary">
              Add
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Scale({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  options: readonly { n: number; label: string }[];
}) {
  return (
    <div>
      <p className="text-seal text-faint">{label}</p>
      <div className="mt-1">
        <SegmentedControl
          ariaLabel={label}
          value={String(value || 0)}
          onChange={(v) => onChange(Number(v))}
          options={options.map((o) => ({ id: String(o.n), label: o.label }))}
        />
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-seal text-faint">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
    </label>
  );
}
