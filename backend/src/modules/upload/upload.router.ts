import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/di";
import { zodErrorHook } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { createRateLimiter, sessionOrIpKey } from "../../middleware/rate-limit";
import { UPLOAD_TYPE_NAMES, UPLOAD_TYPES } from "./upload.util";

const presignSchema = z
  .object({
    contentType: z.enum(UPLOAD_TYPE_NAMES),
    // Signed into the URL: the bucket accepts a body of exactly this size.
    size: z.number().int().positive(),
  })
  .refine((value) => value.size <= UPLOAD_TYPES[value.contentType].maxBytes, {
    path: ["size"],
    message: "Images must be 200 KB or smaller, and voice notes 3 MB",
  });

// Abuse control: each URL still lets a user write an object to the bucket.
const presignRateLimit = createRateLimiter({
  prefix: "rl:presign",
  windowMs: 60_000,
  max: 30,
  keyFn: sessionOrIpKey,
});

export const uploadRouter = new Hono<AppEnv>().post(
  "/presign",
  requireAuth,
  presignRateLimit,
  zValidator("json", presignSchema, zodErrorHook),
  async (c) => {
    const { contentType, size } = c.req.valid("json");
    return c.json(
      await c.var.di.get("upload").presign(contentType, size, c.var.user.id),
    );
  },
);
