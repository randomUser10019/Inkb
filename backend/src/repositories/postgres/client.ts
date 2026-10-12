import pg from "pg";
import { DATABASE_URL } from "../../config/env.ts";

type Status = "ok" | "skip" | "error";

const globalRef = globalThis as typeof globalThis & {
  __inkboardPg__?: pg.Pool;
};

export function postgresConfigured() {
  return Boolean(DATABASE_URL);
}

export function getPool(): pg.Pool | null {
  if (!DATABASE_URL) return null;
  if (!globalRef.__inkboardPg__) {
    globalRef.__inkboardPg__ = new pg.Pool({
      connectionString: DATABASE_URL,
      max: 4,
      ssl: DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalRef.__inkboardPg__;
}

export async function pingPostgres(): Promise<Status> {
  const pool = getPool();
  if (!pool) return "skip";
  try {
    await pool.query("select 1 as ok");
    return "ok";
  } catch (err) {
    console.warn("[postgres] ping failed:", err instanceof Error ? err.message : err);
    return "error";
  }
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = getPool();
  if (!pool) return [];
  const res = await pool.query<T>(text, params);
  return res.rows;
}

export async function withClient<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T | null> {
  const pool = getPool();
  if (!pool) return null;
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
