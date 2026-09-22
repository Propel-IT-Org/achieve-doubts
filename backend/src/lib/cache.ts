import { getRedis } from "./redis";

const memory = new Map<string, { value: unknown; expiresAt: number }>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Read-through cache for expensive reads that tolerate slightly stale data,
 * such as public aggregates.
 *
 * Backed by Redis when configured, so every replica shares one copy, and by
 * an in-memory map otherwise. A cache failure falls back to loading directly:
 * a Redis outage must not take the endpoint down with it.
 *
 * Values go through JSON, so only cache what `c.json()` would send anyway.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const hit = await redis.get(key);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (err) {
      console.error("[cache] read failed, loading directly", err);
    }
  } else {
    const hit = memory.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  }

  // Collapse concurrent misses in this process into a single load, so a cold
  // cache under traffic runs the query once rather than once per request.
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = (async () => {
    try {
      const value = await load();
      if (redis) {
        try {
          await redis.send("SET", [
            key,
            JSON.stringify(value),
            "EX",
            String(ttlSeconds),
          ]);
        } catch (err) {
          console.error("[cache] write failed", err);
        }
      } else {
        memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
      }
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Drops cached keys after a write, so an edit is visible immediately
 * instead of at the end of its TTL. Best-effort, like the cache itself: a
 * failed drop only means the old value lives out its TTL.
 */
export async function invalidate(...keys: string[]) {
	if (keys.length === 0) return;
	for (const key of keys) memory.delete(key);

	const redis = getRedis();
	if (!redis) return;
	try {
		await redis.send("DEL", keys);
	} catch (err) {
		console.error("[cache] invalidate failed", err);
	}
}
