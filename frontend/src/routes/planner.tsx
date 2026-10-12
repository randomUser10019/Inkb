import { createFileRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppErrorComponent } from "@/lib/error-component";

const PlannerShell = lazy(() => import("@/components/planner/planner-shell.tsx").then((m) => ({ default: m.PlannerShell })));

export const Route = createFileRoute("/planner")({
  errorComponent: AppErrorComponent,
  component: PlannerLayout,
});

function PlannerLayout() {
  return (
    <Suspense fallback={<p className="board-pad pt-8 text-sm text-muted">Loading</p>}>
      <PlannerShell>
        <Outlet />
      </PlannerShell>
    </Suspense>
  );
}
