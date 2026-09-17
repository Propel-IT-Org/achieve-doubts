import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

/** In production these have no default — booting without them is a hard error. */
const secret = (devDefault: string, minLength: number) =>
	isProd ? z.string().min(minLength) : z.string().default(devDefault);

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	PORT: z.coerce.number().default(3000),
	DATABASE_URL: isProd
		? z.string().min(1)
		: z.string().default("postgres://postgres:postgres@localhost:5432/achieve_doubts"),
	BETTER_AUTH_SECRET: secret("development_secret_must_be_32_characters_long_min", 32),
	BETTER_AUTH_URL: z.string().default("http://localhost:3000"),
	CORS_ORIGIN: z.string().default("http://localhost:5173"),
	// Admin panel is a separate origin/subdomain; kept distinct from CORS_ORIGIN so the
	// staff-only surface can be origin-restricted independently of the main student/solver site.
	ADMIN_ORIGIN: z.string().default("http://localhost:5174"),
	// Optional. Unset = single-instance mode: in-memory rate limiting and
	// in-process WebSocket fan-out, which is what `bun run dev` uses so local
	// work needs no Redis. REQUIRED as soon as you run more than one backend
	// instance — without it each replica keeps its own rate-limit counters and
	// clients connected to one replica never see events published by another.
	REDIS_URL: z.string().optional(),
	// Where the real client address comes from — see lib/client-ip.ts.
	//   proxy      — DNS points straight at the VPS; Traefik is the only hop.
	//   cloudflare — traffic arrives via Cloudflare (Tunnel, or proxied DNS
	//                with the firewall restricted to Cloudflare's ranges).
	CLIENT_IP_SOURCE: z.enum(["proxy", "cloudflare"]).default("proxy"),
	ATTESTATION_SECRET: secret("dev_attestation_secret_placeholder", 16),
	// Server-to-server shared secret for the Achieve integration handshake (X-Achieve-Auth header).
	ACHIEVE_SHARED_SECRET: secret("dev_achieve_shared_secret_placeholder_change_me", 32),
	// Comma-separated IP allowlist for Achieve's backend. Empty/unset = allow-all (dev only).
	ACHIEVE_ALLOWED_IPS: z.string().optional(),
	LOCK_TIMEOUT_MINUTES: z.coerce.number().default(15),
	// Graceful shutdown (src/main.ts). The drain must outlast one Traefik
	// health-check interval plus its timeout (10s + 5s in compose.yml), so the
	// replica is out of rotation before it stops accepting connections.
	SHUTDOWN_DRAIN_MS: z.coerce.number().int().min(0).default(15_000),
	// After draining, how long in-flight requests get before the remaining
	// connections are force-closed. Drain + this must stay under the
	// container's stop_grace_period.
	SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(0).default(10_000),
	S3_ENDPOINT: z.string().optional(),
	// R2 accepts "auto". Backblaze B2 needs the bucket's real region (e.g.
	// "us-west-004"), or SigV4 signatures won't match.
	S3_REGION: z.string().default("auto"),
	S3_ACCESS_KEY_ID: z.string().optional(),
	S3_SECRET_ACCESS_KEY: z.string().optional(),
	S3_BUCKET_NAME: z.string().default("doubts-media"),
	S3_PUBLIC_URL: z.string().default("http://localhost:9000/doubts-media"),
}).superRefine((value, ctx) => {
	// Uploads need a real bucket. In development they fail only when used
	// (lib/s3.ts); in production a missing bucket fails the boot instead.
	if (value.NODE_ENV !== "production") return;
	for (const key of ["S3_ENDPOINT", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
		if (!value[key]) {
			ctx.addIssue({ code: "custom", path: [key], message: "Required in production" });
		}
	}
	if (value.S3_PUBLIC_URL.includes("localhost")) {
		ctx.addIssue({
			code: "custom",
			path: ["S3_PUBLIC_URL"],
			message: "Must be the bucket's public URL in production",
		});
	}
});

export const env = envSchema.parse(process.env);
