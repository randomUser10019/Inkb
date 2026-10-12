import type { ReactNode } from "react";

export function Glyph({ children }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      {children}
    </svg>
  );
}
