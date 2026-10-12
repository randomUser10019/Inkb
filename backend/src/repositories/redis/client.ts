import { REDIS_URL } from "../../config/env.ts";

type Status = "ok" | "skip" | "error";

export type RedisLike = {
  ping: () => Promise<string>;
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<unknown>;
  quit: () => Promise<unknown>;
};

const globalRef = globalThis as typeof globalThis & {
  __inkboardRedis__?: RedisLike;
};

export function redisConfigured() {
  return Boolean(REDIS_URL);
}

export async function getRedis(): Promise<RedisLike | null> {
  if (!REDIS_URL) return null;
  if (!globalRef.__inkboardRedis__) {
    const Redis = (await import("ioredis")).default;
    globalRef.__inkboardRedis__ = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
    }) as unknown as RedisLike;
  }
  return globalRef.__inkboardRedis__;
}

export async function pingRedis(): Promise<Status> {
  if (!REDIS_URL) return "skip";
  try {
    const redis = await getRedis();
    if (!redis) return "skip";
    const pong = await redis.ping();
    return pong ? "ok" : "error";
  } catch (err) {
    console.warn("[redis] ping failed:", err instanceof Error ? err.message : err);
    return "error";
  }
}
