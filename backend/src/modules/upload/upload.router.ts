import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/di";
import { fail, zodErrorHook } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { createRateLimiter, sessionOrIpKey } from "../../middleware/rate-limit";
import { UPLOAD_TYPE_NAMES, UPLOAD_TYPES } from "./upload.util";

const presignSchema = z
  .object({
    contentType: z.enum(UPLOAD_TYPE_NAMES),
    // The URL can't enforce this, but checking it refuses an oversized file
    // before the browser starts sending it.
    size: z.number().int().positive(),
  })
  .refine((value) => value.size <= UPLOAD_TYPES[value.contentType].maxBytes, {
    path: ["size"],
    message: "Images must be 3 MB or smaller, and recordings 20 MB",
  });

// Each URL can accept a large body, so issuing them is rate limited.
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
  (c) => {
    const { contentType } = c.req.valid("json");
    const upload = c.var.di.get("upload").presign(contentType, c.var.user.id);
    if (!upload) {
      return fail(
        c,
        503,
        "INTERNAL_ERROR",
        "File uploads aren't configured on this server",
      );
    }
    return c.json(upload);
  },
);
