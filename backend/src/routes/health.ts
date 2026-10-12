import type { FastifyInstance } from "fastify";
import { isShuttingDown } from "../lifecycle.ts";
import { pingPostgres } from "../repositories/postgres/client.ts";
import { pingRedis } from "../repositories/redis/client.ts";
import { ffmpegStatus } from "../integrations/ffmpeg/probe.ts";

export async function registerHealth(app: FastifyInstance) {
  app.get("/healthz", async () => ({ ok: true, service: "inkboard-api" }));

  app.get("/readyz", async (_req, reply) => {
    const [postgres, redis] = await Promise.all([pingPostgres(), pingRedis()]);
    const ffmpeg = ffmpegStatus();
    const shuttingDown = isShuttingDown();
    const body = { postgres, redis, ffmpeg, shuttingDown };
    if (shuttingDown || postgres === "error" || redis === "error") {
      return reply.status(503).send(body);
    }
    return body;
  });
}
