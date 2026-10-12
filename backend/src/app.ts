import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { registerHealth } from "./routes/health.ts";
import { registerCatalog } from "./routes/catalog.ts";
import { registerLessons } from "./routes/lessons.ts";
import { registerMedia } from "./routes/media.ts";
import { registerLive } from "./routes/live.ts";
import { registerSearch } from "./routes/search.ts";
import { registerJobs } from "./routes/jobs.ts";
import { registerSummary } from "./routes/summary.ts";
import { registerUpstream } from "./routes/upstream.ts";
import { jsonError, publicError } from "./http.ts";
import { allowRate, rateConfig } from "./middlewares/rate-limit.ts";
import { noteUpstreamOk, reportUpstreamFail, isClientAbort } from "@inkboard/shared/upstream";

const DEFAULT_ORIGINS = [
  "http://127.0.0.1:8080",
  "http://localhost:8080",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://localhost:3000",
];

function allowedOrigins(): Set<string> {
  const extra = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

function longRequest(url: string): boolean {
  const path = url.split("?")[0] || "";
  return path.startsWith("/api/live-board") || path.includes("/artifacts/") || path.endsWith("/clips");
}

function clientAddress(req: FastifyRequest, trustProxy: boolean): string {
  if (trustProxy) return req.ip || "local";
  return req.socket.remoteAddress || "local";
}

export async function buildApp(): Promise<FastifyInstance> {
  const origins = allowedOrigins();
  const trustProxy = process.env.TRUST_PROXY === "1";
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    trustProxy,
    bodyLimit: 1_048_576,
    requestIdHeader: "x-request-id",
    genReqId: (req) => {
      const header = req.headers["x-request-id"];
      return (Array.isArray(header) ? header[0] : header) || crypto.randomUUID();
    },
    requestTimeout: 60_000,
    connectionTimeout: 10_000,
    keepAliveTimeout: 72_000,
  });

  await app.register(cors, {
    origin(origin, cb) {
      if (!origin || origins.has(origin)) cb(null, true);
      else cb(null, false);
    },
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  });

  app.addHook("onRequest", async (req, reply) => {
    reply.header("x-request-id", req.id);
    if (longRequest(req.url) && typeof req.raw.setTimeout === "function") req.raw.setTimeout(0);
    const path = req.url.split("?")[0] || "";
    if (!path.startsWith("/api/")) return;
    const { limit, windowMs } = rateConfig();
    const ip = clientAddress(req, trustProxy);
    if (!(await allowRate(`api:${ip}`, limit, windowMs))) {
      return reply
        .status(429)
        .send(jsonError(429, "Too many requests. Wait a minute.", "RATE_LIMIT", req.id));
    }
  });

  app.setNotFoundHandler((req, reply) => {
    reply
      .status(404)
      .type("application/json; charset=utf-8")
      .send(jsonError(404, "Not found", "NOT_FOUND", req.id));
  });

  app.setErrorHandler((err, req, reply) => {
    const mapped = publicError(err);
    const msg = err instanceof Error ? err.message : "";
    const path = req.url.split("?")[0] || "";
    const sideRequest = /\/probe$|\/slide$|\/notes$|\/artifacts\//.test(path);
    if (
      !sideRequest &&
      !isClientAbort(err) &&
      mapped.status >= 500 &&
      /unacademy|fetch failed|timed out|operation was aborted/i.test(msg)
    ) {
      reportUpstreamFail(req.url, err);
    }
    if (mapped.log) req.log.error({ err }, "request failed");
    reply.status(mapped.status).send(jsonError(mapped.status, mapped.error, mapped.code, req.id));
  });

  app.addHook("onResponse", async (req, reply) => {
    if (reply.statusCode >= 400) return;
    const path = req.url.split("?")[0] || "";
    if (/^\/api\/(courses|exams|educators|teachers|search|lessons|batches|live)\b/.test(path) && !path.endsWith("/probe")) {
      noteUpstreamOk();
    }
  });

  await registerHealth(app);
  await registerCatalog(app);
  await registerLessons(app);
  await registerMedia(app);
  await registerLive(app);
  await registerSearch(app);
  await registerJobs(app);
  await registerSummary(app);
  await registerUpstream(app);

  return app;
}
