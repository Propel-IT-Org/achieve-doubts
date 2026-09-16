import { RedisClient } from "bun";
import { env } from "../env";

/**
 * Shared Redis access, using Bun's built-in client (no dependency needed).
 *
 * Redis is OPTIONAL. With REDIS_URL unset the app behaves exactly as it did
 * single-instance, and nothing here is constructed. Set it before running a
 * second backend replica — see the note on REDIS_URL in env.ts for what
 * breaks otherwise.
 */

let commandClient: RedisClient | null = null;

export function redisEnabled(): boolean {
  return Boolean(env.REDIS_URL);
}

/**
 * Client for ordinary commands (INCR, EXPIRE, PUBLISH). Created lazily —
 * Bun connects on first use, so constructing it never blocks startup.
 */
export function getRedis(): RedisClient | null {
  if (!env.REDIS_URL) return null;
  if (!commandClient) commandClient = new RedisClient(env.REDIS_URL);
  return commandClient;
}

/**
 * A SEPARATE connection, exclusively for subscribing.
 *
 * This is not an optimisation: Redis puts a subscribed connection into
 * subscriber mode, where it refuses ordinary commands. Sharing one client
 * between the rate limiter and the feed relay would break the limiter the
 * moment the relay subscribed.
 */
export function createSubscriber(): RedisClient | null {
  if (!env.REDIS_URL) return null;
  return new RedisClient(env.REDIS_URL);
}
