import { createFileRoute } from "@tanstack/react-router";
import { lazyPage } from "./lazy-page";
export const Route = createFileRoute("/exam/$goalId")({
  component: lazyPage(() => import("@/pages/exam-page")),
});
