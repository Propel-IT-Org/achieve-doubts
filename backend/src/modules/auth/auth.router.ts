import { Hono } from "hono";
import { auth } from "../../lib/auth";
import { authContextMiddleware } from "../../middleware/auth";

export const authRouter = new Hono()
	.get("/me", authContextMiddleware, (c) => {
		const user = c.var.user;
		const session = c.var.session;
		return c.json({ user, session });
	})
	.all("/*", (c) => {
		return auth.handler(c.req.raw);
	});
