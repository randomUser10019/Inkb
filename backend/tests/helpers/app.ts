import type { FastifyInstance } from "fastify";
import { buildApp } from "../../src/app.ts";

export async function testApp(): Promise<FastifyInstance> {
  process.env.LOG_LEVEL ??= "silent";
  return buildApp();
}
