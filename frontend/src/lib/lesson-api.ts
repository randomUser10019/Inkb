import { apiJson, qs } from "./api-client.ts";
import type { Timeline } from "@inkboard/shared/dcn";

export const ARCHIVED_MSG =
  "ARCHIVED: Unacademy moved this recording to cold storage. The video cannot be streamed until they restore it.";

export function isArchivedLessonError(err: unknown) {
  const m = err instanceof Error ? err.message : String(err ?? "");
  return m.includes("ARCHIVED") || m.includes("cold storage");
}

export async function loadLessonTimeline({ data }: { data: { id: string } }): Promise<Timeline> {
  const id = data.id.trim();
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) throw new Error("Invalid lesson id");
  return apiJson<Timeline>(`/api/lessons/${encodeURIComponent(id)}/timeline`);
}

export type NotesHit = { url: string; filename: string; kind: "notes" | "slides" };

export async function resolveLessonNotes({
  data,
}: {
  data: { id: string; title?: string };
}): Promise<NotesHit | null> {
  const id = data.id.trim();
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) throw new Error("Invalid lesson id");
  return apiJson<NotesHit | null>(`/api/lessons/${encodeURIComponent(id)}/notes${qs({ title: data.title })}`);
}

export type ReplayMedia = { archived: boolean };

export async function probeReplayMedia({
  data,
}: {
  data: { ids: string[] };
}): Promise<Record<string, ReplayMedia>> {
  return apiJson<Record<string, ReplayMedia>>("/api/lessons/probe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids: data.ids ?? [] }),
  });
}
