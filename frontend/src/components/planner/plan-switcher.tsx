import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/planner/confirm-dialog.tsx";
import { archivePlan, deletePlan, duplicatePlan, patchPlan, setActivePlan, undoLast, visiblePlans } from "@inkboard/shared/planner/storage";
import { usePlanner } from "@inkboard/shared/planner/use-planner";

export function PlanSwitcher() {
  const { plan, state } = usePlanner();
  const plans = visiblePlans(state);
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(plan?.name ?? "");

  useEffect(() => {
    if (renaming) nameRef.current?.focus();
  }, [renaming]);
  if (!plan) {
    return (
      <Link to="/planner/new" className="inline-flex h-11 items-center text-sm font-semibold text-primary">
        Lay out a plan
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className="h-11 max-w-full truncate text-left font-serif text-sm hover:text-primary"
        aria-expanded={open}
        aria-label={`Plan ${plan.name}`}
        onClick={() => setOpen((v) => !v)}
      >
        {plan.name}
      </button>
      {open ? (
        <ul className="mt-1 divide-y divide-line border-y border-line">
          {plans.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`flex h-11 w-full items-center text-left text-sm ${p.id === plan.id ? "text-primary" : "text-muted hover:text-fg"}`}
                onClick={() => {
                  setActivePlan(p.id);
                  setOpen(false);
                }}
              >
                {p.name}
              </button>
            </li>
          ))}
          <li>
            {renaming ? (
              <form
                className="py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = name.trim();
                  if (next) patchPlan(plan.id, { name: next });
                  setRenaming(false);
                }}
              >
                <input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="sheet-field"
                  aria-label="Plan name"
                />
              </form>
            ) : (
              <button
                type="button"
                className="flex h-11 w-full items-center text-left text-sm text-muted hover:text-fg"
                onClick={() => {
                  setName(plan.name);
                  setRenaming(true);
                }}
              >
                Rename
              </button>
            )}
          </li>
          <li>
            <button
              type="button"
              className="flex h-11 w-full items-center text-left text-sm text-muted hover:text-fg"
              onClick={() => {
                duplicatePlan(plan.id);
                toast.success("Duplicated", { action: { label: "Undo", onClick: () => undoLast() } });
                setOpen(false);
              }}
            >
              Duplicate
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex h-11 w-full items-center text-left text-sm text-muted hover:text-fg"
              onClick={() => {
                archivePlan(plan.id);
                toast.success("Archived", { action: { label: "Undo", onClick: () => undoLast() } });
                setOpen(false);
              }}
            >
              Archive
            </button>
          </li>
          <li>
            <button
              type="button"
              className="flex h-11 w-full items-center text-left text-sm text-danger"
              onClick={() => setConfirmId(plan.id)}
            >
              Delete
            </button>
          </li>
          <li>
            <Link to="/planner/new" className="flex h-11 items-center text-sm text-primary">
              Lay out a plan
            </Link>
          </li>
        </ul>
      ) : null}
      <ConfirmDialog
        open={Boolean(confirmId)}
        title="Delete this plan?"
        body="A recovery point is saved first. You can undo right after."
        confirmLabel="Delete plan"
        onClose={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) {
            deletePlan(confirmId);
            toast.success("Plan deleted", { action: { label: "Undo", onClick: () => undoLast() } });
          }
          setConfirmId(null);
        }}
      />
    </>
  );
}
