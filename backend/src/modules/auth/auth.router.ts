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

/** The integration spec's error envelope, not the API's usual one. */
const specError = (errorCode: string, message: string) => ({
	status: "error",
	error_code: errorCode,
	message,
});

/**
 * Gate for the SERVER-TO-SERVER handshake only. It must not cover
 * /achieve/sso: that one is opened by students' browsers, so an allowlist
 * there would lock every student out the moment ACHIEVE_ALLOWED_IPS is set.
 */
const achieveIpGate = ipRestriction(
	// Must be the proxy-observed address, not the first X-Forwarded-For entry:
	// that one is caller-supplied and would let anyone forge their way past
	// this allowlist. See lib/client-ip.ts.
	(c) => clientIpFromHeaders(c.req.raw.headers),
	{ allowList: achieveAllowedIps },
	(_remote, c) =>
		c.json(
			specError("IP_NOT_ALLOWED", "Source IP not in the Provider's allowlist."),
			403,
		),
);

/**
 * Every student's handshake arrives from Achieve's few server addresses, so
 * a per-IP limit here is really a platform-wide cap on logins per minute.
 * It is set high on purpose: the shared secret and the allowlist are the real
 * gate, and this only stops a runaway client.
 */
const initiateRateLimit = createRateLimiter({
	prefix: "rl:achieve-initiate",
	windowMs: 60_000,
	max: 600,
	onLimited: (c) => c.json(specError("RATE_LIMITED", "Too many requests."), 429),
});

/**
 * Opened by browsers, once per login. Tokens are 256-bit and single-use, so
 * this is abuse control rather than brute-force defence — and it is generous
 * because students on mobile carriers share addresses behind CGNAT. It is a
 * page navigation, so a limited student is sent back to the site, not shown
 * a JSON error.
 */
const ssoRateLimit = createRateLimiter({
	prefix: "rl:achieve-sso",
	windowMs: 60_000,
	max: 120,
	onLimited: (c) => c.redirect(`${env.CORS_ORIGIN}/?ssoError=rate_limited`),
});

export const authRouter = new Hono<AppEnv>({ strict: false })
	.use("/achieve/sessions/*", achieveIpGate, initiateRateLimit)
	.use("/achieve/sso", ssoRateLimit)
	.on(["GET", "POST"], "/*", (c) => {
		return c.var.di.get("auth").handler(c.req.raw);
	});
