import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { env } from "../env";

const IS_TURNSTILE_SUSPENDED = true;

export const appCheckMiddleware = createMiddleware(async (c, next) => {
	if (IS_TURNSTILE_SUSPENDED || env.NODE_ENV === "development") {
		await next();
		return;
	}

	const token = c.req.header("X-App-Check-Token");
	if (!token) {
		return c.json({ error: "Missing App-Check attestation" }, 403);
	}

	try {
		const payload = await verify(token, env.ATTESTATION_SECRET);
		if (!payload || payload.iss !== "doubt-app-attestation") {
			return c.json({ error: "Invalid attestation source" }, 403);
		}
	} catch {
		return c.json({ error: "Attestation expired or corrupt" }, 403);
	}

	await next();
});
