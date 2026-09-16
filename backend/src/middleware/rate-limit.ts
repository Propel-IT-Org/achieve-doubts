import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { AppError } from "../lib/errors";

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
}

const defaultKeyFn = (c: Context) =>
	c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
	c.req.header("cf-connecting-ip") ??
	c.req.header("x-real-ip") ??
	"unknown";

/**
 * In-memory sliding-window rate limiter. Single-process only — fine for a
 * single backend instance today, but will not coordinate across replicas.
 * Multi-instance deployments need a shared store (e.g. Redis) instead.
 */
export function createRateLimiter({ windowMs, max, keyFn = defaultKeyFn, onLimited }: RateLimitOptions) {
	const buckets = new Map<string, Bucket>();

	return createMiddleware(async (c, next) => {
		const key = keyFn(c);
		const now = Date.now();
		const bucket = buckets.get(key);

		if (!bucket || bucket.resetAt <= now) {
			buckets.set(key, { count: 1, resetAt: now + windowMs });
		} else {
			bucket.count += 1;
			if (bucket.count > max) {
				if (onLimited) return await onLimited(c);
				throw new AppError(429, "RATE_LIMITED", "Too many requests");
			}
		}

		// Opportunistic cleanup so the map doesn't grow unbounded.
		if (buckets.size > 10_000) {
			for (const [k, v] of buckets) {
				if (v.resetAt <= now) buckets.delete(k);
			}
		}

		await next();
	});
}
