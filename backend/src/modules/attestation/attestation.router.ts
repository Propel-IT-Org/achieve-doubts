import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";

export const attestationRouter = new Hono<AppEnv>().post(
	"/exchange",
	async (c) => {
		const token = await c.var.di.get("attestation").generateToken();
		return c.json({ token });
	},
);