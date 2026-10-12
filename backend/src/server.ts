import { buildApp } from "./app.ts";
import { BACKEND_HOST, BACKEND_PORT } from "./config/env.ts";
import { beginShutdown } from "./lifecycle.ts";
import { ensureSchema } from "./repositories/postgres/schema.ts";
import { pingPostgres } from "./repositories/postgres/client.ts";
import { pingRedis } from "./repositories/redis/client.ts";
import { installHostLookup, lookupHost } from "@inkboard/shared/ssrf";

installHostLookup(lookupHost);

try {
  await ensureSchema();
} catch (err) {
  console.warn("[postgres] schema:", err instanceof Error ? err.message : err);
}

const [postgres, redis] = await Promise.all([pingPostgres(), pingRedis()]);
console.log(`[inkboard-api] stores postgres=${postgres} redis=${redis}`);

const app = await buildApp();
await app.listen({ host: BACKEND_HOST, port: BACKEND_PORT });
console.log(`[inkboard-api] http://${BACKEND_HOST}:${BACKEND_PORT}`);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  beginShutdown();
  console.log(`[inkboard-api] ${signal}, closing`);
  const timer = setTimeout(() => process.exit(1), 10_000);
  try {
    await app.close();
  } finally {
    clearTimeout(timer);
  }
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

