import type { FastifyReply, FastifyRequest } from "fastify";
import { HttpError } from "@inkboard/shared/http-error";

export function toWebRequest(req: FastifyRequest, signal: AbortSignal): Request {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "127.0.0.1");
  const proto = String(req.headers["x-forwarded-proto"] ?? "http");
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, String(value));
    }
  }
  return new Request(`${proto}://${host}${req.url}`, { method: req.method, headers, signal });
}

export async function sendWebResponse(reply: FastifyReply, res: Response): Promise<void> {
  reply.hijack();
  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-encoding") return;
    headers[key] = value;
  });
  reply.raw.writeHead(res.status, headers);
  if (!res.body) {
    reply.raw.end();
    return;
  }
  const reader = res.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      reply.raw.write(value);
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      /* closed */
    }
  } finally {
    try {
      reply.raw.end();
    } catch {
      /* closed */
    }
  }
}

export function jsonError(status: number, error: string, code: string, requestId?: string) {
  return { error, code, requestId };
}

const CLIENT_EXACT: Record<string, { status: number; code: string }> = {
  "Unknown exam": { status: 400, code: "BAD_REQUEST" },
  "Unknown subject": { status: 400, code: "BAD_REQUEST" },
  "Invalid lesson id": { status: 400, code: "BAD_REQUEST" },
  "Invalid class id": { status: 400, code: "BAD_REQUEST" },
  "Invalid params": { status: 400, code: "BAD_REQUEST" },
  "Invalid query": { status: 400, code: "BAD_REQUEST" },
  "Invalid body": { status: 400, code: "BAD_REQUEST" },
  "Invalid request": { status: 400, code: "BAD_REQUEST" },
  "Enter a teacher username": { status: 400, code: "BAD_REQUEST" },
  "Type at least 2 characters": { status: 400, code: "BAD_REQUEST" },
  "A chapter or a pin is required": { status: 400, code: "BAD_REQUEST" },
  "invalid summary": { status: 400, code: "BAD_REQUEST" },
};

const UPSTREAM_EXACT = new Set([
  "This wall did not load",
  "This shelf did not load",
  "No Unacademy teacher with that username",
  "Notes too large",
  "Unexpected notes format",
  "Summary is unavailable right now",
  "Unacademy published that as a playlist, not a course — open the teacher instead.",
]);

function flattenMessage(err: unknown): string {
  if (err instanceof Error) {
    const issues = (err as Error & { issues?: Array<{ message?: string }> }).issues;
    if (err.name === "ZodError" && Array.isArray(issues) && issues[0]?.message) return "Bad request";
    return err.message;
  }
  return "failed";
}

/** Map a thrown value to a client-safe body. Unknown failures stay generic. */
export function publicError(err: unknown): { status: number; code: string; error: string; log: boolean } {
  if (err instanceof HttpError) {
    const status = err.status;
    return {
      status,
      code: err.code,
      error: status >= 500 && status !== 503 ? "Something went wrong" : err.message,
      log: status >= 500,
    };
  }
  if (err instanceof Error && err.name === "ZodError") {
    const exact = CLIENT_EXACT[err.message];
    if (exact) return { ...exact, error: err.message, log: false };
    if (/unknown exam/i.test(err.message)) return { status: 400, code: "BAD_REQUEST", error: "Unknown exam", log: false };
    return { status: 400, code: "BAD_REQUEST", error: "Bad request", log: false };
  }
  const msg = flattenMessage(err);
  if (msg.startsWith("ARCHIVED:") || /cold storage/i.test(msg)) {
    return { status: 410, code: "ARCHIVED", error: "This class is in cold storage", log: false };
  }
  const exact = CLIENT_EXACT[msg];
  if (exact) return { ...exact, error: msg === "invalid summary" ? "Bad request" : msg, log: false };
  if (/^Invalid [\w ]+ id$/.test(msg)) return { status: 400, code: "BAD_REQUEST", error: msg, log: false };
  if (UPSTREAM_EXACT.has(msg) || /^Unacademy (request|page) failed \(\d{3}\)$/.test(msg)) {
    return { status: 502, code: "UPSTREAM", error: msg, log: true };
  }
  const statusCode =
    typeof err === "object" && err && "statusCode" in err ? Number((err as { statusCode: number }).statusCode) : 0;
  if (statusCode === 413) {
    return { status: 413, code: "PAYLOAD_TOO_LARGE", error: "Request body is too large", log: false };
  }
  if (statusCode >= 400 && statusCode < 500) {
    const safe = msg.length > 0 && msg.length < 160 && !msg.includes("\n") && !msg.includes("/") ? msg : "Bad request";
    return {
      status: statusCode,
      code: statusCode === 404 ? "NOT_FOUND" : statusCode === 429 ? "RATE_LIMIT" : "BAD_REQUEST",
      error: safe,
      log: false,
    };
  }
  return { status: 500, code: "INTERNAL", error: "Something went wrong", log: true };
}

export function statusForMessage(msg: string): { status: number; code: string } {
  const mapped = publicError(new Error(msg));
  return { status: mapped.status, code: mapped.code };
}

export async function handleJson<T>(
  reply: FastifyReply,
  requestId: string,
  run: () => Promise<T>,
): Promise<T | FastifyReply> {
  try {
    return await run();
  } catch (err) {
    const mapped = publicError(err);
    if (mapped.log) reply.log.error({ err, requestId }, "request failed");
    return reply.status(mapped.status).send(jsonError(mapped.status, mapped.error, mapped.code, requestId));
  }
}

export function requestIdOf(req: FastifyRequest): string {
  return String(req.headers["x-request-id"] || req.id || "");
}
