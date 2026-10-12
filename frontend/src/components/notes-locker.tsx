import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { TAKE_SHEETS_EVENT } from "@inkboard/shared/shelf";
import { COPY } from "@inkboard/shared/copy";
import type { UaLesson } from "@/lib/unacademy";
import {
  NOTES_REVOKE_MS,
  NOTES_WARN_COUNT,
  collectNotesFiles,
  downloadNotesCopy,
  fetchNotesZip,
  groupSavedByWeek,
  notesFileCounts,
  notesZipReport,
  notesZipSummary,
  windowsSafeName,
  type FetchNotesResult,
  type NotesZipSaved,
} from "@inkboard/shared/notes-zip";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), NOTES_REVOKE_MS);
}

function releaseBytes(files: NotesZipSaved[]) {
  for (const file of files) file.bytes = new Uint8Array(0);
}

async function zipFiles(filename: string, files: NotesZipSaved[], result: FetchNotesResult) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const file of files) zip.file(file.path, file.bytes);
  zip.file("_report.txt", notesZipReport(result));
  const blob = await zip.generateAsync({ type: "blob" });
  releaseBytes(files);
  triggerDownload(blob, filename);
}

async function zipResult(courseName: string, result: FetchNotesResult) {
  await zipFiles(`${windowsSafeName(courseName)} notes.zip`, result.saved, result);
}

async function zipWeeks(courseName: string, result: FetchNotesResult) {
  const groups = groupSavedByWeek(result.saved);
  for (const group of groups) {
    const name = `${windowsSafeName(courseName)} ${windowsSafeName(group.week)} notes.zip`;
    await zipFiles(name, group.files, result);
  }
}

function dialogFocusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
}

export function NotesLocker({ lessons, courseName }: { lessons: UaLesson[]; courseName: string }) {
  const files = useMemo(() => collectNotesFiles(lessons), [lessons]);
  const counts = useMemo(() => notesFileCounts(files), [files]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<FetchNotesResult | null>(null);
  const [err, setErr] = useState("");
  const [needConfirm, setNeedConfirm] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  function rememberOpener() {
    const active = document.activeElement;
    if (active instanceof HTMLElement) openerRef.current = active;
  }

  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setNeedConfirm(false);
    window.setTimeout(() => openerRef.current?.focus(), 0);
  }, [busy]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  async function runFetch() {
    if (busy || !files.length) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setErr("");
    setResult(null);
    setNeedConfirm(false);
    setOpen(true);
    setBusy(true);
    setProgress(`Fetching 0 / ${files.length}`);
    try {
      const next = await fetchNotesZip(files, {
        fetch,
        signal: ctrl.signal,
        onProgress: ({ index, total, name }) => {
          setProgress(`Fetching ${index} / ${total} · ${name}`);
        },
      });
      setResult(next);
      setProgress("");
      if (!next.cancelled && !next.stopped && next.saved.length && !next.splitByWeek) {
        await zipResult(courseName, next);
      }
      if (!next.saved.length && !next.stopped && !next.cancelled) {
        setErr("None of the PDFs were available to zip.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "These notes did not zip.");
    } finally {
      setBusy(false);
    }
  }

  function startFrom(el?: HTMLElement | null) {
    if (busy || !files.length) return;
    if (el) openerRef.current = el;
    else rememberOpener();
    setOpen(true);
    if (files.length > NOTES_WARN_COUNT) {
      setNeedConfirm(true);
      setResult(null);
      setErr("");
      return;
    }
    void runFetch();
  }

  async function downloadPartial() {
    if (!result?.saved.length) return;
    if (result.splitByWeek) await zipWeeks(courseName, result);
    else await zipResult(courseName, result);
  }

  async function downloadPerWeek() {
    if (!result?.saved.length) return;
    await zipWeeks(courseName, result);
  }

  useEffect(() => {
    const onTake = () => startFrom();
    window.addEventListener(TAKE_SHEETS_EVENT, onTake);
    return () => window.removeEventListener(TAKE_SHEETS_EVENT, onTake);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, courseName, busy]);

  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    const first = root ? dialogFocusables(root)[0] : null;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (busy) cancel();
        else close();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const nodes = dialogFocusables(root);
      if (!nodes.length) return;
      const firstEl = nodes[0]!;
      const lastEl = nodes[nodes.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, result, needConfirm, close, cancel]);

  if (files.length === 0 && !err && !open) return null;

  const label = downloadNotesCopy(counts.known, counts.guessed);
  const stoppedWait = result?.stopped?.retryAfter
    ? `Try again later (${result.stopped.retryAfter}s)`
    : "Try again later";
  const guessedMissing = result?.missing.filter((row) => row.guessed) ?? [];
  const knownMissing = result?.missing.filter((row) => !row.guessed) ?? [];

  function onBackdrop(e: ReactMouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (!busy) close();
  }

  return (
    <>
      {label ? (
        <button
          type="button"
          className="h-11 text-sm text-primary"
          aria-label={label}
          disabled={busy}
          onClick={(e) => startFrom(e.currentTarget)}
        >
          {label}
        </button>
      ) : null}
      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-bg/70 p-4"
          role="presentation"
          onClick={onBackdrop}
        >
          <div
            ref={dialogRef}
            className="sheet w-full max-w-md p-5"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notes-zip-title"
            aria-busy={busy}
          >
            <p id="notes-zip-title" className="font-serif text-xl">
              Download all notes
            </p>
            <p className="mt-2 text-caption text-faint">{COPY.notesArePdfs}</p>
            <p className="sr-only" aria-live="polite">
              {progress || (result ? notesZipSummary(result.saved.length, result.missing.length) : err)}
            </p>
            {files.length > NOTES_WARN_COUNT ? (
              <p className="mt-3 text-sm text-muted">
                {files.length} files — this stays under 60 requests a minute and may take a while.
              </p>
            ) : null}
            {needConfirm && !busy && !result ? (
              <p className="mt-3 text-sm text-muted">Start when you are ready. Cancel anytime.</p>
            ) : null}
            {busy ? (
              <p className="mt-3 text-sm text-muted" aria-live="polite">
                {progress || "Fetching…"}
              </p>
            ) : null}
            {result && !busy ? (
              <div className="mt-3">
                <p className="text-sm text-fg">{notesZipSummary(result.saved.length, result.missing.length)}</p>
                {result.splitByWeek ? (
                  <p className="mt-2 text-sm text-muted">Over 400 MB together — one zip per week is safer.</p>
                ) : null}
                {result.stopped ? (
                  <p className="mt-2 text-sm text-muted">
                    Stopped at HTTP {result.stopped.status}
                    {result.stopped.retryAfter ? ` · Retry-After ${result.stopped.retryAfter}` : ""}.
                  </p>
                ) : null}
                {result.cancelled ? <p className="mt-2 text-sm text-muted">Cancelled.</p> : null}
                {knownMissing.length ? (
                  <ul className="mt-3 max-h-32 overflow-y-auto text-caption text-muted">
                    {knownMissing.map((row) => (
                      <li key={row.path}>
                        {row.path} · {row.reason}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {guessedMissing.length ? (
                  <div className="mt-3">
                    <p className="text-caption text-faint">Not on the CDN</p>
                    <ul className="mt-1 max-h-32 overflow-y-auto text-caption text-faint">
                      {guessedMissing.map((row) => (
                        <li key={row.path}>{row.path}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {err ? <p className="mt-3 text-sm text-danger">{err}</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {busy ? (
                <button type="button" className="rail-btn" onClick={cancel}>
                  Cancel
                </button>
              ) : needConfirm && !result ? (
                <>
                  <button type="button" className="rail-btn" onClick={() => void runFetch()}>
                    Start download
                  </button>
                  <button type="button" className="rail-btn" onClick={close}>
                    Close
                  </button>
                </>
              ) : (
                <>
                  {result?.saved.length && result.splitByWeek ? (
                    <button type="button" className="rail-btn" onClick={() => void downloadPerWeek()}>
                      Download zip per week
                    </button>
                  ) : null}
                  {result?.saved.length && (result.stopped || result.cancelled) && !result.splitByWeek ? (
                    <button type="button" className="rail-btn" onClick={() => void downloadPartial()}>
                      Download what we have
                    </button>
                  ) : null}
                  {result?.stopped ? (
                    <button type="button" className="rail-btn" onClick={close}>
                      {stoppedWait}
                    </button>
                  ) : (
                    <button type="button" className="rail-btn" onClick={close}>
                      Close
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
