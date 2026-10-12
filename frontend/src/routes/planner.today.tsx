import { createFileRoute } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { lazyPage } from "./lazy-page";

export const Route = createFileRoute("/planner/today")({
  validateSearch: (s: Record<string, unknown>) => ({
    add: s.add === 1 || s.add === "1" || s.add === true ? 1 : undefined,
  }),
  errorComponent: AppErrorComponent,
  component: lazyPage(() => import("@/components/planner/today-page.tsx").then((m) => ({ default: m.PlannerTodayPage }))),
});
