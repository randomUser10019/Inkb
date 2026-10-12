import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { addCustomTask, addVacation, undoLast } from "@inkboard/shared/planner/storage";
import type { EventKind, StudyPlan } from "@inkboard/shared/planner/types";

const KINDS: { id: EventKind; label: string; minutes: number }[] = [
  { id: "study", label: "Custom study", minutes: 40 },
  { id: "mock", label: "Mock test", minutes: 180 },
  { id: "pyq", label: "PYQ practice", minutes: 60 },
  { id: "exam", label: "Exam date", minutes: 0 },
  { id: "holiday", label: "Holiday range", minutes: 0 },
];

export function AddTaskForm({
  plan,
  date,
  onDone,
}: {
  plan: StudyPlan;
  date: string;
  onDone?: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<EventKind>("study");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(date);
  const [until, setUntil] = useState(date);
  const [minutes, setMinutes] = useState(40);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (kind === "holiday") {
      addVacation(plan.id, when, until);
      toast.success("Holiday marked", { action: { label: "Undo", onClick: () => undoLast() } });
      onDone?.();
      return;
    }
    const label = title.trim() || KINDS.find((k) => k.id === kind)?.label || "Task";
    addCustomTask(plan.id, {
      title: label,
      date: when,
      durationMin: kind === "exam" ? 0 : minutes,
      type: "custom",
      eventKind: kind,
    });
    toast.success("Added", { action: { label: "Undo", onClick: () => undoLast() } });
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3 text-sm">
      <div className="write-kinds">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className={kind === k.id ? "is-on" : ""}
            onClick={() => {
              setKind(k.id);
              setMinutes(k.minutes || 40);
            }}
          >
            {k.label}
          </button>
        ))}
      </div>
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Write a task"
        className="write-line-input"
      />
      <label className="block text-caption text-muted">
        Date
        <input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className="write-line-input mt-1" />
      </label>
      {kind === "holiday" ? (
        <label className="block text-caption text-muted">
          Until
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="write-line-input mt-1" />
        </label>
      ) : kind !== "exam" ? (
        <label className="block text-caption text-muted">
          Minutes
          <input
            type="number"
            min={5}
            max={480}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 40)}
            className="write-line-input mt-1"
          />
        </label>
      ) : null}
      <button type="submit" className="h-11 text-sm text-primary">
        Add
      </button>
    </form>
  );
}
