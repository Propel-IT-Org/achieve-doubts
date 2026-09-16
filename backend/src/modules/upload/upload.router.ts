import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/di";
import { requireAuth } from "../../middleware/auth";
import { ALLOWED_CONTENT_TYPES } from "./upload.util";

const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  // Only these types get a signed URL — an unknown content type is rejected
  // before any credential is issued.
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
});

export const uploadRouter = new Hono<AppEnv>()
  .post("/presign", requireAuth, zValidator("json", presignSchema), async (c) => {
    const { fileName, contentType } = c.req.valid("json");
    const presigned = await c.var.di
      .get("upload")
      .createPresignedUpload(fileName, contentType, c.var.user.id);
    return c.json(presigned);
  })
  // Dev-only stand-in for object storage when S3 isn't configured. It stores
  // nothing — it exists so the presign flow returns a URL that resolves.
  .put("/mock", async (c) => {
    const key = c.req.query("key") || `mock-${Date.now()}`;
    return c.json({ success: true, key });
  });
