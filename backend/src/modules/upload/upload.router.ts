import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { env } from "../../env";
import type { AppEnv } from "../../lib/di";
import { fail, zodErrorHook } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { createRateLimiter, sessionOrIpKey } from "../../middleware/rate-limit";
import {
  ALLOWED_CONTENT_TYPES,
  formatMegabytes,
  LARGEST_UPLOAD_BYTES,
  LOCAL_UPLOAD_ROUTE,
  TYPE_BY_EXTENSION,
  UPLOAD_RULES,
} from "./upload.util";

const presignSchema = z
  .object({
    contentType: z.enum(ALLOWED_CONTENT_TYPES),
    // Not enforceable by the URL (see upload.service.ts), but checking the
    // declared size refuses an oversized file before it is ever sent. The
    // real check happens when the upload is attached.
    size: z.number().int().positive(),
  })
  .superRefine((value, ctx) => {
    const { maxBytes } = UPLOAD_RULES[value.contentType];
    if (value.size > maxBytes) {
      ctx.addIssue({
        code: "custom",
        path: ["size"],
        message: `Files of this type must be ${formatMegabytes(maxBytes)} or smaller`,
      });
    }
  });

const presignRateLimit = createRateLimiter({
  prefix: "rl:presign",
  windowMs: 60_000,
  max: 60,
  keyFn: sessionOrIpKey,
});

/** Only the local stand-in for object storage is served by these routes. */
const localKey = (path: string) =>
  decodeURIComponent(path.slice(`${LOCAL_UPLOAD_ROUTE}/`.length));

export const uploadRouter = new Hono<AppEnv>()
  /**
   * Issues a short-lived URL the browser PUTs the file to directly. Images
   * are compressed in the browser before this is called.
   */
  .post(
    "/presign",
    requireAuth,
    presignRateLimit,
    zValidator("json", presignSchema, zodErrorHook),
    (c) => {
      const { contentType } = c.req.valid("json");
      return c.json(
        c.var.di
          .get("upload")
          .createPresignedUpload(contentType, c.var.user.id),
      );
    },
  )
  // Development stand-ins for the bucket, used only when S3 isn't
  // configured. Like a real presigned URL, the PUT is unauthenticated; the
  // attach-time check is what vouches for the file.
  .put("/local/*", async (c) => {
    const uploads = c.var.di.get("upload");
    if (env.NODE_ENV === "production" || uploads.isConfigured) {
      return fail(c, 404, "NOT_FOUND", "Not found");
    }

    const body = await c.req.blob();
    if (body.size > LARGEST_UPLOAD_BYTES) {
      return fail(c, 413, "PAYLOAD_TOO_LARGE", "Upload too large");
    }

    const stored = await uploads.writeLocal(localKey(c.req.path), body);
    if (!stored) return fail(c, 404, "NOT_FOUND", "Not found");
    return c.body(null, 200);
  })
  .get("/local/*", async (c) => {
    const uploads = c.var.di.get("upload");
    if (env.NODE_ENV === "production" || uploads.isConfigured) {
      return fail(c, 404, "NOT_FOUND", "Not found");
    }

    const key = localKey(c.req.path);
    const file = uploads.readLocal(key);
    if (!file || !(await file.exists())) {
      return fail(c, 404, "NOT_FOUND", "Not found");
    }

    const extension = key.slice(key.lastIndexOf(".") + 1);
    return new Response(file, {
      headers: {
        // Derived from the key, never from what the uploader sent.
        "content-type": TYPE_BY_EXTENSION[extension] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox",
        "cache-control": "private, max-age=3600",
      },
    });
  });
