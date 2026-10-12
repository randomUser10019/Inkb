import type { FastifyInstance } from "fastify";
import { loadUpstreamHealth } from "@/services/upstream-health.ts";
import { noteUpstreamOk } from "@inkboard/shared/upstream";

export async function registerUpstream(app: FastifyInstance) {
  app.get("/api/upstream/health", async () => loadUpstreamHealth());
  app.post("/api/upstream/ok", async () => {
    noteUpstreamOk();
    return { ok: true as const };
  });
}
