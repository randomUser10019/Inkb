import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { StatusPanel } from "@/components/skeleton";
import { notesHref } from "@inkboard/shared/notes";
import { resolveLessonNotes } from "@/lib/lesson-api";

export function ArchivedLesson({
  lessonId,
  title,
  educator,
  backTo,
  notesUrl,
}: {
  lessonId: string;
  title: string;
  educator?: string;
  backTo: string;
  notesUrl?: string | null;
}) {
  const notes = useQuery({
    queryKey: ["notes", lessonId, title],
    queryFn: () => resolveLessonNotes({ data: { id: lessonId, title } }),
    enabled: !notesUrl,
  });
  const hitUrl = notesUrl || notes.data?.url || "";
  const pdf = hitUrl ? notesHref({ url: hitUrl, view: true }) : "";
  const download = hitUrl ? notesHref({ url: hitUrl }) : "";

  return (
    <AppShell>
      <main className="board-pad py-10">
        <a href={backTo} className="ink-underline text-sm text-muted">
          ← Shelf
        </a>
        <p className="text-seal mt-6 text-warn">Archived</p>
        <h1 className="chalk-draw mt-2 font-serif text-display">{title}</h1>
        {educator ? <p className="mt-1 text-sm text-muted">{educator}</p> : null}
        <p className="mt-3 max-w-[65ch] text-sm text-muted">
          The recording sits in cold storage, so the board cannot stream until the file is restored. Sheets often still fold.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          {download ? (
            <a href={download} download className="inline-flex h-11 items-center text-sm font-semibold text-primary">
              Take the sheets
            </a>
          ) : null}
        </div>
        {pdf ? (
          <div className="mt-6 overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px var(--color-line)" }}>
            <iframe title={`${title} notes`} src={pdf} className="h-[min(78vh,900px)] w-full bg-surface" />
          </div>
        ) : notes.isLoading ? (
          <p className="mt-8 text-sm text-muted">Looking for the class PDF…</p>
        ) : (
          <StatusPanel tone="empty" title="Nothing on this shelf yet" body="No notes PDF is on the CDN for this class either." />
        )}
      </main>
    </AppShell>
  );
}
