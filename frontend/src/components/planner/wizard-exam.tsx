import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { openCommandPalette } from "@inkboard/shared/command-palette";
import { COPY } from "@inkboard/shared/copy";
import { EXAMS } from "@inkboard/shared/exams";
import { WriteField } from "@/components/folio/shelf.tsx";

export function WizardExam({
  examId,
  onPick,
}: {
  examId: string;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    return EXAMS.filter((e) => `${e.name} ${e.blurb} ${e.family ?? ""}`.toLowerCase().includes(needle)).slice(0, 8);
  }, [q]);

  return (
    <div>
      <WriteField value={q} onChange={setQ} label={COPY.writeAnExam} placeholder={COPY.writeAnExam} />
      {hits.length ? (
        <ol className="mt-6">
          {hits.map((e, i) => (
            <li key={e.id}>
              <button
                type="button"
                className="chalk-row w-full text-left"
                onClick={() => onPick(e.id)}
              >
                <span className="chalk-line">
                  <span className="chalk-num tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`chalk-title${examId === e.id ? " text-primary" : ""}`}>{e.name}</span>
                    <span className="chalk-meta">{e.blurb}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 text-sm text-muted">
          The wall already has the exams.{" "}
          <button
            type="button"
            className="ink-underline"
            onClick={() => {
              void nav({ to: "/" });
              openCommandPalette();
            }}
          >
            {COPY.writeAnExam}
          </button>
        </p>
      )}
    </div>
  );
}
