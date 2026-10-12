import { Command } from "cmdk";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { EXAMS } from "@inkboard/shared/exams";
import { readLater, readRecents, readSaved, pushRecent } from "@inkboard/shared/library";
import { readHistory } from "@inkboard/shared/watch-history";
import { writeExamId, readExamId } from "@inkboard/shared/exam-pref";
import {
  PALETTE_EVENT,
  buildPaletteRows,
  groupWriteLine,
  rankTeacherRows,
  rankWriteLine,
  teacherNameQuery,
  teacherQuery,
  writeLineCopy,
  writeLineLead,
  type PaletteRow,
  type WriteMode,
} from "@inkboard/shared/command-palette";
import { COPY } from "@inkboard/shared/copy";
import { parseAtUser } from "@inkboard/shared/jump";
import { searchDesk } from "@/lib/jump-search.ts";
import { ATELIER_MQ, LEDGER_COLLAPSE_KEY } from "@inkboard/shared/folio";
import { liveTasks } from "@inkboard/shared/planner/types";
import { activePlan } from "@inkboard/shared/planner/storage";
import { createRecoveryPoint } from "@inkboard/shared/planner/recovery";
import { allHistoryRows, sessionsToCsv } from "@inkboard/shared/planner/history";
import { liveSessions } from "@inkboard/shared/planner/sessions";
import { downloadProgressCard, progressCardStats } from "@inkboard/shared/planner/progress-card";
import { usePlannerSnapshot } from "@inkboard/shared/planner/use-planner";
import { readThemeMode, resolvedTheme } from "@inkboard/shared/theme";

export function WriteLine() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<WriteMode>("write");
  const [query, setQuery] = useState("");
  const [deskTeachers, setDeskTeachers] = useState<PaletteRow[]>([]);
  const [folded, setFolded] = useState(false);
  const seedRef = useRef("");
  const modeRef = useRef<WriteMode>("write");
  const nav = useNavigate();
  const state = usePlannerSnapshot();
  const plan = activePlan(state);
  const triggerRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
      }
    };
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ seed?: string; mode?: WriteMode }>).detail;
      seedRef.current = detail?.seed ?? "";
      modeRef.current = detail?.mode === "teachers" ? "teachers" : "write";
      setMode(modeRef.current);
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setQuery(seedRef.current);
      setMode(modeRef.current);
      seedRef.current = "";
      try {
        setFolded(localStorage.getItem(LEDGER_COLLAPSE_KEY) === "1" || !window.matchMedia(ATELIER_MQ).matches);
      } catch {
        setFolded(true);
      }
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    const prev = triggerRef.current;
    if (prev) window.setTimeout(() => prev.focus(), 0);
    setDeskTeachers([]);
    modeRef.current = "write";
  }, [open]);

  const library = useMemo(() => {
    if (!open) {
      return { saved: [] as { username: string; name: string }[], recents: [] as { q: string }[], later: [] as ReturnType<typeof readLater>, history: [] as ReturnType<typeof readHistory> };
    }
    return {
      saved: readSaved().map((t) => ({ username: t.username, name: t.name })),
      recents: readRecents().map((r) => ({ q: r.q })),
      later: readLater(),
      history: readHistory(),
    };
  }, [open]);

  const lectures = useMemo(() => {
    if (!open || !plan) return [];
    return liveTasks(plan.tasks)
      .filter((t) => t.lessonId)
      .slice(0, 24)
      .map((t) => ({
        lessonId: t.lessonId!,
        title: t.title,
        teacher: t.teacher,
        course: t.courseId ?? undefined,
      }));
  }, [open, plan]);

  useEffect(() => {
    if (!open) return;
    const q = mode === "teachers" ? teacherNameQuery(query) : teacherQuery(query) || parseAtUser(query);
    if (q.length < 2) {
      setDeskTeachers([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void searchDesk({ data: { q, goalId: readExamId() ?? "" } })
        .then((page) => {
          if (cancelled) return;
          setDeskTeachers(
            page.teachers.map((hit) => ({
              group: "Teachers" as const,
              value: `desk ${hit.id}`,
              label: hit.label,
              hint: hit.hint,
              avatar: hit.avatar,
              href: hit.href.kind === "teacher" ? hit.href : { kind: "search" as const, q: hit.id },
            })),
          );
        })
        .catch(() => {
          if (!cancelled) setDeskTeachers([]);
        });
    }, 160);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, query, mode]);

  useEffect(() => {
    const root = overlayRef.current;
    if (!open || !root) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>("input,button,[cmdk-item],a")].filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
      );
      if (nodes.length < 2) return;
      const first = nodes[0]!;
      const last = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    root.addEventListener("keydown", onKey);
    return () => root.removeEventListener("keydown", onKey);
  }, [open]);

  const rows = useMemo(() => {
    if (!open) return [];
    if (mode === "teachers") {
      const saved: PaletteRow[] = library.saved.map((t) => ({
        group: "Teachers" as const,
        value: `saved ${t.username} ${t.name}`,
        label: t.name || t.username,
        hint: `@${t.username}`,
        href: { kind: "teacher" as const, slug: t.username },
      }));
      const seen = new Set<string>();
      const merged: PaletteRow[] = [];
      for (const row of [...deskTeachers, ...saved]) {
        const key = row.href.kind === "teacher" ? row.href.slug.toLowerCase() : row.value;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push(row);
      }
      return rankTeacherRows(merged, query);
    }
    const built = buildPaletteRows({
      query,
      exams: EXAMS.map((e) => ({ id: e.id, name: e.name, group: e.group, family: e.family })),
      saved: library.saved,
      recents: library.recents,
      later: library.later,
      history: library.history,
      lectures,
    });
    const seen = new Set(built.map((r) => r.value));
    for (const extra of deskTeachers) {
      if (seen.has(extra.value)) continue;
      built.unshift(extra);
    }
    const lead = writeLineLead({ query, history: library.history, hasPlan: Boolean(plan) });
    return rankWriteLine(built, lead);
  }, [open, query, library, lectures, deskTeachers, plan, mode]);

  const grouped = useMemo(() => groupWriteLine(rows), [rows]);

  if (!open) return null;

  function close() {
    setOpen(false);
  }

  function goPath(to: string, search?: Record<string, string | number | undefined>) {
    if (to === "/") return void nav({ to: "/" });
    if (to === "/planner") return void nav({ to: "/planner", search: { day: undefined } });
    if (to === "/planner/today") return void nav({ to: "/planner/today", search: { add: search?.add ? 1 : undefined } });
    if (to === "/planner/history") return void nav({ to: "/planner/history", search: { log: search?.log ? 1 : undefined } });
    if (to === "/planner/dashboard") return void nav({ to: "/planner/dashboard" });
    if (to === "/planner/analytics") return void nav({ to: "/planner/analytics" });
    if (to === "/planner/badges") return void nav({ to: "/planner/badges" });
    if (to === "/planner/journal") return void nav({ to: "/planner/journal" });
    if (to === "/planner/settings") return void nav({ to: "/planner/settings" });
    if (to === "/planner/new") return void nav({ to: "/planner/new" });
    void nav({ to: "/" });
  }

  function run(row: PaletteRow) {
    close();
    const href = row.href;
    if (href.kind === "exam") {
      writeExamId(href.id);
      void nav({ to: "/exam/$goalId", params: { goalId: href.id } });
      return;
    }
    if (href.kind === "teacher") {
      pushRecent(href.slug);
      void nav({ to: "/teacher/$slug", params: { slug: href.slug } });
      return;
    }
    if (href.kind === "search") {
      pushRecent(href.q);
      void nav({ to: "/search", search: { q: href.q } });
      return;
    }
    if (href.kind === "play") {
      void nav({
        to: "/play/$lessonId",
        params: { lessonId: href.lessonId },
        search: { title: href.title, teacher: href.teacher, course: href.course },
      });
      return;
    }
    if (href.kind === "path") {
      goPath(href.to, href.search);
      return;
    }
    if (href.name === "recovery") {
      if (!createRecoveryPoint("manual")) toast.error(COPY.recoveryMarkFail);
      else toast.success("Recovery point saved");
      return;
    }
    if (href.name === "csv") {
      const csv = sessionsToCsv(allHistoryRows(plan, liveSessions()));
      const blob = new Blob([csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "inkboard-history.csv";
      a.click();
      toast.success("History CSV downloaded");
      return;
    }
    if (!plan) {
      toast.message("Lay out a plan first");
      return;
    }
    const minutes = state.days.reduce((n, d) => n + d.minutesStudied, 0);
    const streakDays = state.days.filter((d) => d.tasksDone > 0 || d.minutesStudied >= 20).length;
    downloadProgressCard(
      progressCardStats(plan, streakDays, minutes),
      resolvedTheme(readThemeMode(), window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
    toast.success("Progress card downloaded");
  }

  return (
    <div
      ref={overlayRef}
      className={`write-line-overlay${mode === "teachers" ? " is-teachers" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inkboard-write-title"
    >
      <p id="inkboard-write-title" className="sr-only">
        {mode === "teachers" ? COPY.writeATeacher : COPY.writeWhere}
      </p>
      <button type="button" className="absolute inset-0 z-0" tabIndex={-1} aria-label="Close write line" onClick={close} />
      <Command
        className={`write-line ${folded ? "is-folded" : ""}`}
        shouldFilter={mode !== "teachers"}
        filter={mode === "teachers" ? () => 1 : undefined}
        loop
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="write-line-field">
          <Command.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder={mode === "teachers" ? COPY.writeATeacher : COPY.writeWhere}
            className="write-line-input"
            aria-label={mode === "teachers" ? COPY.writeATeacher : COPY.writeWhere}
            aria-autocomplete="list"
            aria-controls="inkboard-write-list"
            role="combobox"
            aria-expanded
          />
          <span className="write-line-rule" aria-hidden="true" />
        </div>
        <Command.List id="inkboard-write-list" className="write-line-list" role="listbox">
          <Command.Empty className="px-1 py-6 font-serif text-sm text-muted">
            {mode === "teachers"
              ? query.trim().length >= 2
                ? `No teachers named “${query.trim()}”.`
                : COPY.writeATeacher
              : "Nothing on the board for that."}
          </Command.Empty>
          {grouped.map((g, gi) => (
            <Command.Group key={g.group || "lead"} heading={mode === "teachers" ? undefined : g.group || undefined} className="write-line-group">
              {g.items.map((row, i) => (
                <Command.Item
                  key={row.value}
                  value={`${writeLineCopy(row)} ${row.value}`}
                  onSelect={() => run(row)}
                  role="option"
                  className={`write-line-item chalk-draw${i === 1 ? "-2" : i > 1 ? "-3" : ""}`}
                  style={{ animationDelay: `${(gi * 2 + i) * 40}ms` }}
                >
                  {mode === "teachers" ? (
                    row.avatar ? (
                      <img src={row.avatar} alt="" className="write-line-face" />
                    ) : (
                      <span className="write-line-face is-blank" aria-hidden="true" />
                    )
                  ) : null}
                  <span className="min-w-0 truncate font-serif">{writeLineCopy(row)}</span>
                  {row.hint ? <span className="min-w-0 max-w-[40%] shrink truncate text-caption text-faint">{row.hint}</span> : null}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
        <p className="mt-4 text-caption text-faint">
          {mode === "teachers"
            ? query.trim().length >= 2
              ? `${rows.length} teacher${rows.length === 1 ? "" : "s"} · Esc closes`
              : "Teachers only · Esc closes"
            : "Esc closes · Ctrl/Cmd+K toggles"}
        </p>
      </Command>
    </div>
  );
}

export function CommandPalette() {
  return <WriteLine />;
}
