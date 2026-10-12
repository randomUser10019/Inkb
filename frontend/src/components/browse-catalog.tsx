import { Link } from "@tanstack/react-router";
import { examsByGroup, type Exam } from "@inkboard/shared/exams";

export function ExamCatalog({
  current,
  onPrefetch,
}: {
  current?: string | null;
  onPrefetch?: (id: string) => void;
}) {
  return (
    <div className="space-y-10">
      {examsByGroup().map(({ group, families }) => (
        <section key={group}>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">{group}</h2>
          <div className="mt-3 space-y-4">
            {families.map((fam) => (
              <div key={`${group}-${fam.label || fam.exams[0]?.id}`}>
                {fam.label && fam.exams.length > 1 ? (
                  <p className="mb-2 text-caption text-faint">{fam.label}</p>
                ) : null}
                <ul className="desk-exams">
                  {fam.exams.map((exam) => (
                    <li key={exam.id}>
                      <ExamRow exam={exam} group={group} current={current === exam.id} onPrefetch={onPrefetch} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ExamRow({
  exam,
  group,
  current,
  onPrefetch,
}: {
  exam: Exam;
  group: string;
  current: boolean;
  onPrefetch?: (id: string) => void;
}) {
  return (
    <Link
      to="/exam/$goalId"
      params={{ goalId: exam.id }}
      onMouseEnter={() => onPrefetch?.(exam.id)}
      className={`desk-exam no-underline ${current ? "is-current" : ""}`}
    >
      <span className="desk-exam-tick" data-group={group} aria-hidden="true" />
      <span className="desk-exam-mark" data-group={group} aria-hidden="true">
        {exam.name.slice(0, 1)}
      </span>
      <span className="min-w-0">
        <span className="block text-h3 text-fg">{exam.name}</span>
        <span className="mt-0.5 block truncate text-sm text-muted">{exam.blurb}</span>
      </span>
    </Link>
  );
}
