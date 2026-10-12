import type { FastifyInstance } from "fastify";
import { searchDesk } from "@/services/desk-search.ts";
import { DeskSearchInput, parseInput } from "../dto/validate.ts";
import { handleJson, requestIdOf } from "../http.ts";

export async function registerSearch(app: FastifyInstance) {
  app.get("/api/search/desk", async (req, reply) => {
    const data = parseInput(DeskSearchInput, req.query ?? {}, "query");
    return handleJson(reply, requestIdOf(req), () => searchDesk({ q: data.q, goalId: data.goalId }));
  });
}
