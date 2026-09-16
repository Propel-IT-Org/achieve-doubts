import { Hono } from "hono";
import { ipRestriction } from "hono/ip-restriction";
import { env } from "../../env";
import { clientIpFromHeaders } from "../../lib/client-ip";
import type { AppEnv } from "../../lib/di";
import { createRateLimiter } from "../../middleware/rate-limit";

// Comma-separated IP allowlist for Achieve's backend. Empty/unset = allow-all
// (dev only — production deployments should set this).
const achieveAllowedIps = (env.ACHIEVE_ALLOWED_IPS ?? "")
	.split(",")
	.map((ip) => ip.trim())
	.filter(Boolean);

const achieveIpGate = ipRestriction(
	// Must be the proxy-observed address, not the first X-Forwarded-For entry:
	// that one is caller-supplied and would let anyone forge their way past
	// this allowlist. See lib/client-ip.ts.
	(c) => clientIpFromHeaders(c.req.raw.headers),
	{ allowList: achieveAllowedIps },
	(_remote, c) =>
		c.json(
			{
				status: "error",
				error_code: "IP_NOT_ALLOWED",
				message: "Source IP not in the Provider's allowlist.",
			},
			403,
		),
);

const achieveRateLimit = createRateLimiter({
	windowMs: 60_000,
	max: 30,
	onLimited: (c) =>
		c.json(
			{ status: "error", error_code: "RATE_LIMITED", message: "Too many requests." },
			429,
		),
});

export const authRouter = new Hono<AppEnv>({ strict: false })
	.use("/achieve/*", achieveIpGate, achieveRateLimit)
	.on(["GET", "POST"], "/*", (c) => {
		return c.var.di.get("auth").handler(c.req.raw);
	});
