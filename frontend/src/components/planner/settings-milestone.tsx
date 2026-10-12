import { useState } from "react";
import { uid } from "@inkboard/shared/planner/ids";
import type { MilestoneGoal } from "@inkboard/shared/planner/profile";

export function MilestoneForm({ onAdd }: { onAdd: (m: MilestoneGoal) => void }) {
  const [subject, setSubject] = useState("");
  const [by, setBy] = useState("");
  return (
    <form
      className="mt-2 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!subject.trim() || !by) return;
        onAdd({ id: uid("ms"), subject: subject.trim(), by });
        setSubject("");
        setBy("");
      }}
    >
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Physics"
        className="sheet-field min-w-0 flex-1"
        aria-label="Milestone subject"
      />
      <input
        type="date"
        value={by}
        onChange={(e) => setBy(e.target.value)}
        className="sheet-field w-auto"
        aria-label="Finish by"
      />
      <button type="submit" className="h-11 text-sm font-semibold text-primary">
        Add
      </button>
    </form>
  );
}
