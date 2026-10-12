import { useEffect, useState } from "react";
import { FolioShell } from "@/components/folio/shell";
import { InlineAlert } from "@/components/ui/planner/kit.tsx";
import { COPY } from "@inkboard/shared/copy";
import { isBrowserOffline, readTodayCache } from "@inkboard/shared/planner/offline";
import { usePlanner } from "@inkboard/shared/planner/use-planner";

export function PlannerShell({ children }: { children: React.ReactNode }) {
  const { quotaError } = usePlanner();

  return (
    <FolioShell>
      <a
        href="#planner-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[80] focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg"
      >
        {COPY.skipToBoard}
      </a>
      <div id="planner-main" className="board-pad">
        <OfflineBanner />
        {quotaError ? (
          <div className="mb-4">
            <InlineAlert tone="danger" title="Not saved — export a backup" body={quotaError} />
          </div>
        ) : null}
        {children}
      </div>
    </FolioShell>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(isBrowserOffline());
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (!offline) return null;
  const cache = readTodayCache();
  return (
    <div className="mb-4">
      <InlineAlert
        title={COPY.youreOffline}
        body={
          cache
            ? `Today’s plan (“${cache.planName}”, ${cache.tasks.length} items) is saved on this device. The board still works. Sync resumes when you’re back.`
            : "What is already on this device still works. Sync resumes when you’re back."
        }
      />
    </div>
  );
}
