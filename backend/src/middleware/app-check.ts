import { createMiddleware } from "hono/factory";
import { env } from "../env";
import type { AppEnv } from "../lib/di";

const IS_TURNSTILE_SUSPENDED = true;

export const appCheckMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	if (IS_TURNSTILE_SUSPENDED || env.NODE_ENV === "development") {
		await next();
		return;
	}

	const token = c.req.header("X-App-Check-Token");
	if (!token) {
		return c.json({ error: "Missing App-Check attestation" }, 403);
	}

	const isValid = await c.var.di.get("attestation").verifyToken(token);
	if (!isValid) {
		return c.json({ error: "Invalid or expired attestation" }, 403);
	}

	await next();
});