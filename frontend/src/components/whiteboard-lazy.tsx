import { lazy, Suspense, type RefObject } from "react";
import type { Timeline } from "@inkboard/shared/dcn";

const Board = lazy(() => import("@/components/whiteboard").then((m) => ({ default: m.Whiteboard })));

export function LazyWhiteboard(props: {
  timeline: Timeline;
  videoRef: RefObject<HTMLVideoElement | null>;
  clockMs?: number;
  preferClock?: boolean;
  liveBackdrop?: string;
}) {
  return (
    <Suspense fallback={null}>
      <Board {...props} />
    </Suspense>
  );
}
