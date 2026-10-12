import type { ReactNode } from "react";

export function IndexCard({
  kicker,
  title,
  meta,
  progress,
  children,
  tilt = 0,
}: {
  kicker?: string;
  title: string;
  meta?: string;
  progress?: number;
  children?: ReactNode;
  tilt?: number;
}) {
  const pct = progress != null ? Math.max(0, Math.min(100, progress)) : null;
  return (
    <article
      className="index-card"
      style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}
    >
      {kicker ? <p className="text-seal text-faint">{kicker}</p> : null}
      <p className="font-serif text-h3 text-fg">{title}</p>
      {meta ? <p className="mt-1 text-caption text-muted">{meta}</p> : null}
      {pct != null ? (
        <span className="mt-2 block h-px bg-line">
          <span className="block h-px bg-primary" style={{ width: `${pct}%` }} />
        </span>
      ) : null}
      {children}
    </article>
  );
}
