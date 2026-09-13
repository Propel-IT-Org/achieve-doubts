import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";

export const authRouter = new Hono<AppEnv>().all("/*", (c) => {
	return c.var.di.get("auth").handler(c.req.raw);
});
