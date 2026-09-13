import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { createPresignedUploadUrl } from "../../lib/s3";
import { requireAuth } from "../../middleware/auth";

const presignSchema = z.object({
	fileName: z.string().min(1),
	contentType: z.string().min(1),
});

export const uploadRouter = new Hono()
	.post(
		"/presign",
		requireAuth,
		zValidator("json", presignSchema),
		async (c) => {
			const { fileName, contentType } = c.req.valid("json");
			const user = c.var.user;
			const ext = fileName.split(".").pop() || "bin";
			const key = `uploads/${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

			const presigned = await createPresignedUploadUrl(key, contentType);
			return c.json(presigned);
		},
	)
	.put("/mock", async (c) => {
		const key = c.req.query("key") || `mock-${Date.now()}`;
		return c.json({ success: true, key });
	});
