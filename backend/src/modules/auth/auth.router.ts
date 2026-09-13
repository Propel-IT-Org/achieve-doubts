import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { authContextMiddleware } from "../../middleware/auth";

export const authRouter = new Hono<AppEnv>()
	.get("/me", authContextMiddleware, (c) => {
		const user = c.var.user;
		const session = c.var.session;
		return c.json({ user, session });
	})
	.all("/*", (c) => {
		return c.var.di.get("auth").handler(c.req.raw);
	});