import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/di";
import { requireAuth } from "../../middleware/auth";

const presignSchema = z.object({
	fileName: z.string().min(1),
	contentType: z.string().min(1),
});

export const uploadRouter = new Hono<AppEnv>()
	.post(
		"/presign",
		requireAuth,
		zValidator("json", presignSchema),
		async (c) => {
			const { fileName, contentType } = c.req.valid("json");
			const user = c.var.user;
			const presigned = await c.var.di
				.get("upload")
				.createPresignedUpload(fileName, contentType, user.id);
			return c.json(presigned);
		},
	)
	.put("/mock", async (c) => {
		const key = c.req.query("key") || `mock-${Date.now()}`;
		return c.json({ success: true, key });
	});