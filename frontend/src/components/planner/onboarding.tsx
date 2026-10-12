import { Link, useNavigate } from "@tanstack/react-router";
import { openCommandPalette } from "@inkboard/shared/command-palette";
import { COPY } from "@inkboard/shared/copy";
import { useSelectedExam } from "@inkboard/shared/exam-pref";
import { FIRST_SITTING } from "@inkboard/shared/planner/day-board";

export function PlannerOnboarding({ skipHref = "/planner/new" }: { skipHref?: "/planner/new" }) {
  void skipHref;
  const exam = useSelectedExam();
  const nav = useNavigate();

  function writeClass() {
    if (exam) {
      void nav({ to: "/exam/$goalId", params: { goalId: exam.id } });
    } else {
      void nav({ to: "/" });
    }
    openCommandPalette();
  }

  return (
    <div className="max-w-[65ch] py-10">
      <h1 className="font-serif text-display">{FIRST_SITTING.title}</h1>
      <ol className="mt-10">
        <li>
          <button type="button" className="chalk-row w-full text-left" onClick={writeClass}>
            <span className="chalk-line">
              <span className="chalk-num tabular">1</span>
              <span className="chalk-clock tabular">{FIRST_SITTING.clock}</span>
              <span className="min-w-0 flex-1">
                <span className="chalk-title">{COPY.writeAClassFromWall}</span>
              </span>
            </span>
          </button>
        </li>
        <li>
          <Link to="/planner/new" className="chalk-row">
            <span className="chalk-line">
              <span className="chalk-num tabular">2</span>
              <span className="min-w-0 flex-1">
                <span className="chalk-title">{COPY.layOutAPlan}</span>
              </span>
            </span>
          </Link>
        </li>
      </ol>
    </div>
  );
}

/** Empty month / pace: one inscription, not a second first sitting. */
export function BlankInstrument({ kicker }: { kicker: string }) {
  return (
    <div className="max-w-[65ch] py-10">
      <p className="text-seal text-faint">{kicker}</p>
      <h1 className="chalk-draw mt-2 font-serif text-display">{COPY.boardBlank}</h1>
      <Link to="/planner/new" className="mt-6 inline-flex h-11 items-center text-sm font-semibold text-primary">
        {COPY.layOutAPlan}
      </Link>
    </div>
  );
}
