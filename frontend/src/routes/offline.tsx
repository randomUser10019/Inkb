import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const OfflineApp = lazy(() => import("@/features/offline/app.tsx").then((m) => ({ default: m.OfflineApp })));

export const Route = createFileRoute("/offline")({
  component: OfflinePage,
  head: () => ({
    meta: [{ title: "Inkboard — saved classes" }],
  }),
});

function OfflinePage() {
  return (
    <Suspense fallback={<p className="board-pad pt-8 text-sm text-muted">Loading</p>}>
      <OfflineApp embedded />
    </Suspense>
  );
}
