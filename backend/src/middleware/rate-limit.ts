import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { clientIpFromHeaders } from "../lib/client-ip";
import { AppError } from "../lib/errors";
import { getRedis } from "../lib/redis";

interface Bucket {
	count: number;
	resetAt: number;
}

interface RateLimitOptions {
	/** Window size in milliseconds. */
	windowMs: number;
	/** Max requests allowed per key within the window. */
	max: number;
	/** Derives the bucket key from the request. Defaults to the client IP. */
	keyFn?: (c: Context) => string;
	/** Custom response when the limit is hit. Defaults to a 429 AppError. */
	onLimited?: (c: Context) => Response | Promise<Response>;
	/** Distinguishes limiters that would otherwise share a key space. */
	prefix?: string;
}

const defaultKeyFn = (c: Context) => clientIpFromHeaders(c.req.raw.headers);

/**
 * Fixed-window rate limiter, backed by Redis when REDIS_URL is set and by an
 * in-memory Map otherwise.
 *
 * The in-memory path is correct only for a single instance: with N replicas
 * behind Traefik, each keeps its own counters and the effective limit becomes
 * N x max. Redis is what makes the limit mean the same thing everywhere.
 *
 * Fixed window, not sliding: a caller can burst up to 2x max across a window
 * boundary. That is an accepted trade for one INCR per request — this exists
 * to blunt abuse, not to meter billing.
 */
export function createRateLimiter({
	windowMs,
	max,
	keyFn = defaultKeyFn,
	onLimited,
	prefix = "rl",
}: RateLimitOptions) {
	const buckets = new Map<string, Bucket>();

	/** True when this request should be rejected. */
	async function isLimited(key: string): Promise<boolean> {
		const redis = getRedis();

		if (redis) {
			// The window is derived from the clock rather than stored, so the
			// key rolls over on its own and no cleanup pass is needed.
			const window = Math.floor(Date.now() / windowMs);
			const redisKey = `${prefix}:${key}:${window}`;
			try {
				const count = await redis.incr(redisKey);
				// Only the request that created the key sets its TTL.
				if (count === 1) {
					await redis.expire(redisKey, Math.ceil(windowMs / 1000) + 1);
				}
				return count > max;
			} catch (err) {
				// FAIL OPEN, deliberately. If Redis is unreachable, rejecting
				// every request would turn a cache outage into a full outage.
				// Losing rate limiting for the duration is the smaller harm.
				console.error("[rate-limit] Redis unavailable, allowing request", err);
				return false;
			}
		}

		const now = Date.now();
		const bucket = buckets.get(key);

		if (!bucket || bucket.resetAt <= now) {
			buckets.set(key, { count: 1, resetAt: now + windowMs });
		} else {
			bucket.count += 1;
			if (bucket.count > max) return true;
		}

		// Opportunistic cleanup so the map doesn't grow unbounded.
		if (buckets.size > 10_000) {
			for (const [k, v] of buckets) {
				if (v.resetAt <= now) buckets.delete(k);
			}
		}

		return false;
	}

	return createMiddleware(async (c, next) => {
		if (await isLimited(keyFn(c))) {
			if (onLimited) return await onLimited(c);
			throw new AppError(429, "RATE_LIMITED", "Too many requests");
		}
		await next();
	});
}
