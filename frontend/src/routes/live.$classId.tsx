import { createFileRoute } from "@tanstack/react-router";
import { lazyPage } from "./lazy-page";
import { AppErrorComponent } from "@/lib/error-component";
type LiveSearch = { slug?: string; course?: string };
export const Route = createFileRoute("/live/$classId")({
  head: () => ({
    links: [
      { rel: "preconnect", href: "https://static.uacdn.net" },
      { rel: "preconnect", href: "https://player.uacdn.net" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): LiveSearch => ({
    slug: typeof s.slug === "string" ? s.slug : undefined,
    course: typeof s.course === "string" ? s.course : undefined,
  }),
  errorComponent: AppErrorComponent,
  component: lazyPage(() => import("@/pages/live-page")),
});
