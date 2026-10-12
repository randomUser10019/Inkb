import { Link, useRouterState } from "@tanstack/react-router";
import { Bookmark, CalendarDays, ChevronLeft, House, Library, Radio, Search, Settings } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ExamSwitcher } from "@/components/exam-switcher";
import { useTheme } from "@/components/theme-provider.tsx";
import { openCommandPalette } from "@inkboard/shared/command-palette";
import { COPY, streakDaysCopy } from "@inkboard/shared/copy";
import { chromeLabel, otherLocale, type Locale } from "@inkboard/shared/i18n";
import { DESK_ITEMS, deskActive, type DeskItemId } from "@/lib/desk.ts";
import { useSelectedExam } from "@inkboard/shared/exam-pref";
import { usePlannerTodayProgress } from "@inkboard/shared/planner/use-planner";
import { nextThemeMode } from "@inkboard/shared/theme";

const LOCALE_KEY = "inkboard.locale";

const ICONS: Record<DeskItemId, typeof House> = {
  home: House,
  live: Radio,
  library: Library,
  planner: CalendarDays,
  saves: Bookmark,
};

function useChromeLocale() {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const read = () => {
      try {
        setLocale(localStorage.getItem(LOCALE_KEY) === "hi" ? "hi" : "en");
      } catch {
        setLocale("en");
      }
    };
    read();
    window.addEventListener("inkboard-locale", read);
    return () => window.removeEventListener("inkboard-locale", read);
  }, []);
  function toggle() {
    const next = otherLocale(locale);
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* private mode */
    }
    setLocale(next);
    window.dispatchEvent(new Event("inkboard-locale"));
  }
  return { locale, toggle };
}

function DeskLink({
  id,
  active,
  examId,
  stacked,
  locale,
}: {
  id: DeskItemId;
  active: boolean;
  examId: string | null;
  stacked?: boolean;
  locale: Locale;
}) {
  const item = DESK_ITEMS.find((row) => row.id === id)!;
  const Icon = ICONS[id];
  const english = item.id === "library" ? COPY.library : item.id === "planner" ? COPY.todaysPlan : item.label;
  const label = chromeLabel(locale, item.id === "planner" ? "planner" : item.id, english);
  const className = `desk-link ${stacked ? "is-stack" : ""} ${active ? "is-active" : ""}`;
  const inner = (
    <>
      <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
      <span>{label}</span>
    </>
  );
  if (id === "live" && examId) {
    return (
      <Link to="/exam/$goalId" params={{ goalId: examId }} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
        {inner}
      </Link>
    );
  }
  const to = id === "home" || (id === "live" && !examId) ? "/" : id === "library" ? "/search" : id === "planner" ? "/planner/today" : "/offline";
  return (
    <Link to={to} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
      {inner}
    </Link>
  );
}

export function MarginRail() {
  const exam = useSelectedExam();
  const progress = usePlannerTodayProgress();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { mode, setMode } = useTheme();
  const { locale, toggle } = useChromeLocale();
  const active = deskActive(pathname);
  const remaining = Math.max(0, progress.total - progress.done);
  const lampLabel =
    mode === "dark" ? "Theme · dark (next: light)" : mode === "light" ? "Theme · light (next: system)" : "Theme · system (next: dark)";
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const syncOnline = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  return (
    <aside className="desk-rail" aria-label="Navigation">
      <Link to="/" className="desk-mark" aria-label={`Ink, ${COPY.home}`}>
        Ink
      </Link>
      <nav className="desk-rail-nav">
        {DESK_ITEMS.map((item) => (
          <DeskLink key={item.id} id={item.id} active={active === item.id} examId={exam?.id ?? null} locale={locale} stacked />
        ))}
      </nav>
      <div className="desk-rail-foot">
        {progress.streak > 0 ? (
          <p className="desk-rail-meta" title={streakDaysCopy(progress.streak)}>
            {progress.streak}d
          </p>
        ) : null}
        {!online ? <p className="desk-rail-meta">{chromeLabel(locale, "offline", COPY.youreOffline)}</p> : null}
        {progress.total ? (
          <p className="desk-rail-meta">
            {remaining} left
          </p>
        ) : null}
        <Link to="/planner/settings" className="sr-only">
          {COPY.settings}
        </Link>
        <button type="button" className="desk-link is-stack" aria-label={locale === "en" ? "हिंदी" : "EN"} onClick={toggle}>
          <span>{locale === "en" ? "हिंदी" : "EN"}</span>
        </button>
        <button type="button" className="desk-link is-stack" aria-label={lampLabel} onClick={() => setMode(nextThemeMode(mode))}>
          <Settings className="size-5" strokeWidth={1.75} aria-hidden="true" />
          <span>Theme</span>
        </button>
      </div>
    </aside>
  );
}

export function DeskHeader() {
  const progress = usePlannerTodayProgress();
  const remaining = Math.max(0, progress.total - progress.done);
  return (
    <header className="desk-header">
      <ExamSwitcher />
      <div className="ml-auto flex items-center gap-2">
        {progress.total ? (
          <Link to="/planner/today" search={{ add: undefined }} className="desk-chip">
            {COPY.todaysPlan}
            {remaining ? ` · ${remaining} left` : ""}
          </Link>
        ) : null}
        <button
          type="button"
          className="desk-icon-btn"
          aria-label={`${COPY.search} (Control or Command K)`}
          onClick={() => openCommandPalette()}
        >
          <Search className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export function DeskTabs() {
  const exam = useSelectedExam();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { locale } = useChromeLocale();
  const active = deskActive(pathname);
  return (
    <nav className="desk-tabbar" aria-label="Navigation">
      {DESK_ITEMS.map((item) => (
        <DeskLink key={item.id} id={item.id} active={active === item.id} examId={exam?.id ?? null} locale={locale} />
      ))}
    </nav>
  );
}

export function DeskSkip() {
  return (
    <a
      href="#board"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[80] focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg"
    >
      {COPY.skipToBoard}
    </a>
  );
}

export function DeskBack({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh">
      <Link to="/" className="desk-back" aria-label={COPY.backToTheWall}>
        <ChevronLeft className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </Link>
      <main id="board">{children}</main>
    </div>
  );
}
