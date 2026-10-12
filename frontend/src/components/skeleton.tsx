import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function CardSkeleton({ image }: { image?: boolean }) {
  return (
    <div className="overflow-hidden">
      {image ? <Skeleton className="h-16 w-full" /> : null}
      <div className="space-y-2 py-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function TeacherSkeleton() {
  return (
    <div className="stamp-hit">
      <Skeleton className="stamp-face" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

export function HubSkeleton() {
  return (
    <div className="board-state is-loading" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="line-skel" />
      ))}
    </div>
  );
}

export function StatusPanel({
  tone = "empty",
  icon: _icon,
  title,
  body,
  action,
}: {
  tone?: "empty" | "error" | "loading";
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  void _icon;
  return (
    <div className={`board-state${tone === "empty" ? " is-empty" : tone === "loading" ? " is-loading" : " is-error"}`}>
      {tone === "loading" ? (
        <div className="mb-6" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="line-skel" />
          ))}
        </div>
      ) : null}
      {tone === "error" ? <p className="text-seal text-faint">Error</p> : null}
      <h1 className={`chalk-draw font-serif text-display${tone === "error" ? " mt-2" : ""}`}>{title}</h1>
      {body ? <p className="mt-3 max-w-[65ch] text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return <StatusPanel icon={icon} title={title} body={body} action={action} />;
}
