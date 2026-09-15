import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";

export const authRouter = new Hono<AppEnv>({ strict: false }).on(
	["GET", "POST"],
	"/*",
	(c) => {
		return c.var.di.get("auth").handler(c.req.raw);
	},
);
