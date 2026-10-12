import { allowRate as memoryAllow, PROXY_RATE_LIMIT, PROXY_RATE_WINDOW_MS } from "@inkboard/shared/cdn-proxy";
import { getRedis } from "../repositories/redis/client.ts";

export function rateConfig(): { limit: number; windowMs: number } {
  const limit = Number(process.env.RATE_LIMIT);
  const windowMs = Number(process.env.RATE_WINDOW_MS);
  return {
    limit: Number.isFinite(limit) && limit >= 1 && limit <= 10_000 ? Math.floor(limit) : 120,
    windowMs: Number.isFinite(windowMs) && windowMs >= 1_000 && windowMs <= 3_600_000 ? Math.floor(windowMs) : 60_000,
  };
}

export async function allowRate(ip: string, limit = PROXY_RATE_LIMIT, windowMs = PROXY_RATE_WINDOW_MS): Promise<boolean> {
  try {
    const redis = await getRedis();
    if (redis) {
      const key = `rl:${limit}:${windowMs}:${ip}`;
      const n = await redis.incr(key);
      if (n === 1) await redis.pexpire(key, windowMs);
      return n <= limit;
    }
  } catch (err) {
    console.warn("[redis] rate limit failed:", err instanceof Error ? err.message : err);
  }
  return memoryAllow(ip, limit, windowMs);
}
