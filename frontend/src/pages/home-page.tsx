import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, Progress, Skeleton } from "@/components/ui/kit";
import { chromeLabel } from "@inkboard/shared/i18n";
import { COPY } from "@inkboard/shared/copy";
import { useChromeLocale } from "@/lib/use-locale";
import { readHistory, subscribeHistory, type WatchEntry } from "@inkboard/shared/watch-history";

const HomeExams = lazy(() => import("@/components/home-exams").then((m) => ({ default: m.HomeExams })));

function ContinueCard() {
  const [ready, setReady] = useState(false);
  const [entry, setEntry] = useState<WatchEntry | null>(null);
  useEffect(() => {
    const sync = () => setEntry(readHistory()[0] ?? null);
    sync();
    setReady(true);
    return subscribeHistory(sync);
  }, []);
  if (!ready) return <Skeleton className="mt-2 h-28" />;
  if (!entry) return null;
  const pct = entry.duration > 0 ? Math.min(100, Math.round((entry.t / entry.duration) * 100)) : 0;
  const left = entry.duration > 0 ? Math.max(0, entry.duration - entry.t) : 0;
  return (
    <Link to="/play/$lessonId" params={{ lessonId: entry.lessonId }} className="mt-0 block">
      <Card>
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{COPY.onTheBoard}</p>
        <p className="mt-1 text-h3 text-fg">{entry.title}</p>
        <p className="mt-1 text-sm text-muted">
          {entry.teacher ? `${entry.teacher} · ` : ""}
          {left ? `${Math.round(left / 60)} min left` : "Play"}
        </p>
        <Progress value={pct} label="Watched" />
      </Card>
    </Link>
  );
}

export default function Home() {
  const { locale } = useChromeLocale();
  return (
    <AppShell>
      <div className="min-w-0">
        <section className="board-pad pt-8">
          <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Inkboard</p>
          <h1 className="mt-3 text-display">{chromeLabel(locale, "pickExam", "Pick an exam")}</h1>
          <p className="mt-3 max-w-[65ch] text-body text-muted">
            {chromeLabel(locale, "continueLine", "Continue a class, or search teachers and lectures.")}
          </p>
          <Link to="/search" search={{ q: "" }} className="desk-search">
            <Search className="size-4" aria-hidden="true" />
            <span>{chromeLabel(locale, "searchWhere", COPY.writeWhere)}</span>
            <kbd>Ctrl K</kbd>
          </Link>
        </section>
        <section className="board-pad pt-6">
          <ContinueCard />
        </section>
        <section className="board-pad pt-4 pb-20">
          <Suspense fallback={<Skeleton className="h-40" />}>
            <HomeExams />
          </Suspense>
        </section>
      </div>
    </AppShell>
  );
}
