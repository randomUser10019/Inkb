import { createFileRoute } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { lazyPage } from "./lazy-page";

export const Route = createFileRoute("/planner/")({
  errorComponent: AppErrorComponent,
  component: lazyPage(() => import("@/components/planner/calendar-page.tsx").then((m) => ({ default: m.PlannerPage }))),
});
