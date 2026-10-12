import { useEffect, useState } from "react";
import { COPY } from "@inkboard/shared/copy";

/** Shown only when the page's own catalog request failed. A loaded course clears it. */
export function UpstreamBanner() {
  const [down, setDown] = useState(false);
  useEffect(() => {
    const ok = () => setDown(false);
    const bad = () => setDown(true);
    window.addEventListener("inkboard-catalog-ok", ok);
    window.addEventListener("inkboard-catalog-down", bad);
    return () => {
      window.removeEventListener("inkboard-catalog-ok", ok);
      window.removeEventListener("inkboard-catalog-down", bad);
    };
  }, []);
  if (!down) return null;
  return (
    <div className="mx-4 mt-4 flex items-center justify-between gap-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3 text-sm" role="status">
      <p>{COPY.wallDidNotAnswer}</p>
      <button type="button" className="h-11 shrink-0 text-primary" onClick={() => window.location.reload()}>
        {COPY.tryAgain}
      </button>
    </div>
  );
}
