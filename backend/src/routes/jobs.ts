import type { FastifyInstance } from "fastify";
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { JOB_DIR } from "../config/env.ts";
import { jsonError } from "../http.ts";
import { artifactType, safeArtifactPath } from "../integrations/ffmpeg/artifacts.ts";
import { enqueueEnhance, enhanceMedia } from "../integrations/ffmpeg/pipeline.ts";
import { clipArgs, clipFileName, clipWindow } from "../integrations/ffmpeg/plan.ts";
import { ffmpegBinary } from "../integrations/ffmpeg/probe.ts";
import { runFfmpeg } from "../integrations/ffmpeg/run.ts";
import { firstInkSec } from "@inkboard/shared/dcn";
import { ArtifactParams, ClipBody, JobIdParams, LectureJobBody, parseInput } from "../dto/validate.ts";

type JobState = "queued" | "running" | "done" | "error" | "cancelled";
type Job = {
  id: string;
  kind: "lecture" | "chapter" | "course";
  state: JobState;
  pct: number;
  step: string;
  error?: string;
  outDir: string;
  payload: Record<string, unknown>;
  abort: AbortController;
  mediaDir?: string;
};

const jobs = new Map<string, Job>();

export function rememberJob(job: Job) {
  jobs.set(job.id, job);
}

export function jobView(id: string) {
  const job = jobs.get(id);
  if (!job) return null;
  return { id: job.id, state: job.state, error: job.error, mediaDir: job.mediaDir };
}

function persistJob(job: Job) {
  try {
    mkdirSync(job.outDir, { recursive: true });
    writeFileSync(
      join(job.outDir, "job.json"),
      JSON.stringify({
        id: job.id,
        kind: job.kind,
        state: job.state,
        pct: job.pct,
        step: job.step,
        error: job.error,
        outDir: job.outDir,
        mediaDir: job.mediaDir,
        payload: job.payload,
      }),
    );
  } catch {
    /* the in-memory job still serves this process */
  }
  void import("../jobs/pg-queue.ts")
    .then((mod) => mod.mirrorJob(job))
    .catch(() => {
      /* disk copy remains if postgres is down */
    });
}

/** Finished jobs survive a restart so sprite / audio / HLS URLs keep working. */
export function loadStoredJobs(dir = JOB_DIR) {
  if (!existsSync(dir)) return 0;
  let loaded = 0;
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const name of names) {
    const file = join(dir, name, "job.json");
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8")) as Partial<Job>;
      if (!raw.id || !raw.outDir) continue;
      let state: JobState = raw.state === "done" || raw.state === "cancelled" || raw.state === "error" ? raw.state : "error";
      let error = raw.error;
      if (raw.state === "queued" || raw.state === "running") {
        state = "error";
        error = "Interrupted. Save the class again.";
      }
      jobs.set(String(raw.id), {
        id: String(raw.id),
        kind: raw.kind === "chapter" || raw.kind === "course" ? raw.kind : "lecture",
        state,
        pct: Number(raw.pct) || (state === "done" ? 100 : 0),
        step: String(raw.step || state),
        error,
        outDir: String(raw.outDir),
        mediaDir: raw.mediaDir ? String(raw.mediaDir) : undefined,
        payload: raw.payload && typeof raw.payload === "object" ? raw.payload : {},
        abort: new AbortController(),
      });
      loaded += 1;
    } catch {
      /* skip a corrupt job file */
    }
  }
  return loaded;
}

function jobId(kind: string, payload: unknown) {
  return createHash("sha256").update(JSON.stringify({ kind, payload })).digest("hex").slice(0, 24);
}

export function lectureJobPayload(body: {
  id?: string;
  title?: string;
  remux?: boolean;
  noMedia?: boolean;
  noNotes?: boolean;
  enhance?: boolean;
}) {
  const id = String(body.id || "").trim();
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(id)) return null;
  return {
    id,
    title: body.title,
    remux: Boolean(body.remux),
    noMedia: Boolean(body.noMedia),
    noNotes: Boolean(body.noNotes),
    enhance: Boolean(body.enhance),
  };
}

async function runLecture(job: Job) {
  job.state = "running";
  job.step = "saving";
  persistJob(job);
  mkdirSync(job.outDir, { recursive: true });
  const id = String(job.payload.id || "");
  const remux = Boolean(job.payload.remux);
  const { saveLecture } = await import("../cli/lib/save-lecture-core.mjs");
  try {
    const saved = await saveLecture({
      id,
      outDir: job.outDir,
      fetch: globalThis.fetch,
      log: (m: string) => {
        job.step = String(m).slice(0, 180);
      },
      opts: {
        noMedia: Boolean(job.payload.noMedia),
        noNotes: Boolean(job.payload.noNotes),
        remux,
        title: typeof job.payload.title === "string" ? job.payload.title : "",
        signal: job.abort.signal,
      },
    });
    if (saved?.dir) job.mediaDir = saved.dir;
    if (job.payload.enhance && saved?.dir && !job.payload.noMedia) {
      job.step = "enhancing";
      persistJob(job);
      const media = join(saved.dir, "media.webm");
      if (existsSync(media) && statSync(media).size > 0) {
        let ink: number | null = null;
        try {
          if (saved.timeline?.strokes) ink = firstInkSec(saved.timeline);
        } catch {
          ink = null;
        }
        const report = await enqueueEnhance(() =>
          enhanceMedia({ input: media, outDir: saved.dir, firstInkSec: ink, signal: job.abort.signal }),
        );
        const failed = report.steps.filter((s) => !s.ok).map((s) => s.name);
        job.step = report.skipped ? `done (${report.skipped})` : failed.length ? `done (partial: ${failed.join(",")})` : "done";
      }
    }
    job.state = "done";
    job.pct = 100;
    if (job.step === "enhancing" || job.step === "saving") job.step = "done";
    persistJob(job);
  } catch (err) {
    if (job.abort.signal.aborted) {
      job.state = "cancelled";
      job.error = "Stopped";
      persistJob(job);
      return;
    }
    job.state = "error";
    job.error = err instanceof Error ? err.message : String(err);
    persistJob(job);
  }
}

export async function registerJobs(app: FastifyInstance) {
  loadStoredJobs();
  app.post("/api/jobs/lectures", async (req, reply) => {
    const body = parseInput(LectureJobBody, req.body ?? {}, "body");
    const payload = lectureJobPayload(body);
    if (!payload) {
      return reply.status(400).send(jsonError(400, "Invalid lesson id", "BAD_REQUEST"));
    }
    const jid = jobId("lecture", payload);
    const existing = jobs.get(jid);
    if (existing && (existing.state === "queued" || existing.state === "running" || existing.state === "done")) {
      return { id: jid, state: existing.state, pct: existing.pct, step: existing.step };
    }
    const job: Job = {
      id: jid,
      kind: "lecture",
      state: "queued",
      pct: 0,
      step: "queued",
      outDir: join(JOB_DIR, jid),
      payload,
      abort: new AbortController(),
    };
    jobs.set(jid, job);
    persistJob(job);
    void runLecture(job);
    return { id: jid, state: job.state, pct: job.pct, step: job.step, enhance: payload.enhance };
  });

  app.get("/api/jobs/:id/artifacts/*", async (req, reply) => {
    const params = parseInput(ArtifactParams, req.params, "params");
    const job = jobs.get(params.id);
    if (!job) return reply.status(404).send(jsonError(404, "Unknown job", "NOT_FOUND"));
    const root = job.mediaDir || job.outDir;
    const rel = params["*"] || "";
    const abs = safeArtifactPath(root, rel);
    if (!abs) return reply.status(400).send(jsonError(400, "Unknown artifact", "BAD_REQUEST"));
    if (!existsSync(abs)) return reply.status(404).send(jsonError(404, "Artifact not ready", "NOT_FOUND"));
    reply.header("content-type", artifactType(rel));
    reply.header("cache-control", "private, max-age=3600");
    return reply.send(createReadStream(abs));
  });

  app.get("/api/jobs/:id", async (req, reply) => {
    const params = parseInput(JobIdParams, req.params, "params");
    const job = jobs.get(params.id);
    if (!job) return reply.status(404).send(jsonError(404, "Unknown job", "NOT_FOUND"));
    return { id: job.id, state: job.state, pct: job.pct, step: job.step, error: job.error };
  });

  app.post("/api/jobs/:id/clips", async (req, reply) => {
    const params = parseInput(JobIdParams, req.params, "params");
    const job = jobs.get(params.id);
    if (!job) return reply.status(404).send(jsonError(404, "Unknown job", "NOT_FOUND"));
    const root = job.mediaDir || job.outDir;
    const body = parseInput(ClipBody, req.body ?? {}, "body");
    const window = clipWindow(Number(body.start), Number(body.end));
    if (!window) return reply.status(400).send(jsonError(400, "Clip must be between 1 second and 20 minutes", "BAD_REQUEST"));
    const media = ["media.mp4", "media.webm"].map((name) => join(root, name)).find((abs) => existsSync(abs));
    if (!media) return reply.status(404).send(jsonError(404, "Prepare this class before saving a clip", "NOT_FOUND"));
    const rel = clipFileName(window.start, window.end);
    const abs = safeArtifactPath(root, rel);
    if (!abs) return reply.status(400).send(jsonError(400, "Unknown artifact", "BAD_REQUEST"));
    if (!existsSync(abs)) {
      const bin = ffmpegBinary();
      if (!bin) return reply.status(503).send(jsonError(503, "ffmpeg is not available", "UNAVAILABLE"));
      mkdirSync(join(root, "clips"), { recursive: true });
      try {
        await enqueueEnhance(() => runFfmpeg(bin, clipArgs(media, abs, window.start, window.end), { timeoutMs: 15 * 60_000 }));
      } catch (err) {
        req.log.error({ err }, "clip failed");
        return reply.status(500).send(jsonError(500, "Something went wrong", "CLIP_FAILED"));
      }
    }
    return { url: `/api/jobs/${job.id}/artifacts/${rel}`, start: window.start, end: window.end };
  });

  app.delete("/api/jobs/:id", async (req, reply) => {
    const params = parseInput(JobIdParams, req.params, "params");
    const job = jobs.get(params.id);
    if (!job) return reply.status(404).send(jsonError(404, "Unknown job", "NOT_FOUND"));
    job.abort.abort();
    job.state = "cancelled";
    persistJob(job);
    return { id: job.id, state: job.state };
  });
}
