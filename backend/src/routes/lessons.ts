import type { FastifyInstance } from "fastify";
import { loadLessonTimeline, probeReplayMedia, resolveLessonNotes } from "@/services/lesson-media.ts";
import { LessonNotesQuery, LessonParams, parseInput, probeIds } from "../dto/validate.ts";
import { handleJson, requestIdOf } from "../http.ts";
import { badRequest } from "@inkboard/shared/http-error";

export async function registerLessons(app: FastifyInstance) {
  app.get("/api/lessons/:id/timeline", async (req, reply) => {
    const data = parseInput(LessonParams, req.params, "lesson id");
    if (!data.id) throw badRequest("Invalid lesson id");
    return handleJson(reply, requestIdOf(req), () => loadLessonTimeline({ id: data.id }));
  });

  app.get("/api/lessons/:id/notes", async (req, reply) => {
    const params = parseInput(LessonParams, req.params, "lesson id");
    const query = parseInput(LessonNotesQuery, req.query ?? {}, "query");
    return handleJson(reply, requestIdOf(req), () => resolveLessonNotes({ id: params.id, title: query.title }));
  });

  app.post("/api/lessons/probe", async (req, reply) => {
    const ids = probeIds(req.body);
    return handleJson(reply, requestIdOf(req), () => probeReplayMedia({ ids }));
  });
}
