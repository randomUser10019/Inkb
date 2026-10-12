import { createFileRoute } from "@tanstack/react-router";
import { lazyPage } from "./lazy-page";
import type { TeacherTab } from "@/components/educator-catalog";
type TeacherSearch = { topic?: string; sort?: "latest" | "popular"; tab?: TeacherTab };
function parseTab(v: unknown): TeacherTab {
  return v === "batches" || v === "free" ? v : "courses";
}
export const Route = createFileRoute("/teacher/$slug")({
  validateSearch: (s: Record<string, unknown>): TeacherSearch => ({
    topic: typeof s.topic === "string" ? s.topic : undefined,
    sort: s.sort === "popular" ? "popular" : s.sort === "latest" ? "latest" : undefined,
    tab: parseTab(s.tab),
  }),
  component: lazyPage(() => import("@/pages/teacher-page")),
});
