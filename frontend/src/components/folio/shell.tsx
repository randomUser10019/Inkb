import { useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { DeskBack, DeskHeader, DeskSkip, DeskTabs, MarginRail } from "@/components/folio/margin";
import { UpstreamBanner } from "@/components/upstream-banner";
import { Toast } from "@/components/ui/kit";
import { COPY } from "@inkboard/shared/copy";
import {
  LEDGER_EVENT,
  LEDGER_FOCUS_EVENT,
  boardRoom,
  folioMode,
  isTypingTarget,
  type LedgerFocus,
} from "@inkboard/shared/folio";

const SavedSheet = lazy(() => import("@/components/folio/saved-sheet").then((m) => ({ default: m.SavedSheet })));

export function FolioShell({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const mode = folioMode(pathname);
  const room = boardRoom(pathname);
  const [sheet, setSheet] = useState(false);
  const [focus, setFocus] = useState<LedgerFocus>("auto");

  useEffect(() => {
    const onToggle = () => setSheet((v) => !v);
    const onFocus = (e: Event) => {
      setFocus((e as CustomEvent<LedgerFocus>).detail ?? "library");
      setSheet(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener(LEDGER_EVENT, onToggle);
    window.addEventListener(LEDGER_FOCUS_EVENT, onFocus);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(LEDGER_EVENT, onToggle);
      window.removeEventListener(LEDGER_FOCUS_EVENT, onFocus);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    setSheet(false);
    setFocus("auto");
  }, [pathname]);

  if (compact) return <DeskBack>{children}</DeskBack>;

  return (
    <div className="desk-root bg-bg text-fg">
      <DeskSkip />
      <MarginRail />
      <div className="desk-col">
        <DeskHeader />
        <main id="board" key={room} className="desk-main">
          <UpstreamBanner />
          {pathname.startsWith("/planner") ? null : <ShellOffline />}
          {children}
        </main>
      </div>
      <DeskTabs />
      {sheet ? (
        <Suspense fallback={null}>
          <SavedSheet mode={mode} focus={focus} onOpenChange={setSheet} />
        </Suspense>
      ) : null}
    </div>
  );
}

function ShellOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="board-pad pt-4">
      <Toast title={COPY.youreOffline} body="Saved work on this device still works." />
    </div>
  );
}
