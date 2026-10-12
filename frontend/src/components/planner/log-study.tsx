import { useState } from "react";
import { toast } from "sonner";
import { logManualStudy, undoLast } from "@inkboard/shared/planner/storage";

export function LogStudyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [start, setStart] = useState("");
  const [minutes, setMinutes] = useState(45);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const iso = start ? new Date(start).toISOString() : new Date().toISOString();
    const result = logManualStudy({ startIso: iso, durationMin: minutes, subject, notes });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Logged a session", { action: { label: "Undo", onClick: () => undoLast() } });
    onClose();
  }

  return (
    <form onSubmit={submit} className="log-sheet mt-4 w-full p-0" aria-labelledby="log-study-title">
      <h2 id="log-study-title" className="font-serif text-h3">
        Log study
      </h2>
      <p className="mt-1 text-sm text-muted">For lectures you watched somewhere else. Counts toward the mark.</p>
      <label className="mt-4 block text-caption">
        Start
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="sheet-field mt-1"
        />
      </label>
      <label className="mt-3 block text-caption">
        Minutes
        <input
          type="number"
          min={1}
          max={720}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="sheet-field mt-1"
        />
      </label>
      <label className="mt-3 block text-caption">
        Subject
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="sheet-field mt-1"
        />
      </label>
      <label className="mt-3 block text-caption">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="sheet-field mt-1 h-auto py-2"
        />
      </label>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onClose} className="h-11 text-sm text-muted">
          Cancel
        </button>
        <button type="submit" className="h-11 text-sm font-semibold text-primary">
          Save
        </button>
      </div>
    </form>
  );
}
