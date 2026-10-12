import { catalogSignal } from "@inkboard/shared/catalog-signal";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function qs(rec: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(rec)) {
    if (v == null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function noteCatalog(path: string, ok: boolean, status: number) {
  if (typeof window === "undefined") return;
  const kind = catalogSignal(path, ok, status);
  if (kind === "ok") window.dispatchEvent(new Event("inkboard-catalog-ok"));
  if (kind === "down") window.dispatchEvent(new Event("inkboard-catalog-down"));
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  const res = await fetch(path, { ...init, headers });
  if (res.status === 204) return null as T;
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { error: text };
    }
  }
  if (!res.ok) {
    noteCatalog(path, false, res.status);
    const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const msg = typeof rec.error === "string" ? rec.error : res.statusText || "Request failed";
    const code = typeof rec.code === "string" ? rec.code : "ERROR";
    throw new ApiError(res.status, msg, code);
  }
  noteCatalog(path, true, res.status);
  return body as T;
}
