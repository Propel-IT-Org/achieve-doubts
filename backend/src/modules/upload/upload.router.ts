import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { env } from "../../env";
import type { AppEnv } from "../../lib/di";
import { type ApiErrorBody, fail, zodErrorHook } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
import { createRateLimiter, sessionOrIpKey } from "../../middleware/rate-limit";
import { MediaError, processAudio, processImage } from "./upload.media";
import {
  AUDIO_MAX_BYTES,
  CONTENT_TYPE_BY_EXTENSION,
  formatMegabytes,
  IMAGE_MAX_INPUT_BYTES,
  LOCAL_UPLOAD_ROUTE,
  UPLOAD_BODY_LIMIT,
} from "./upload.util";

const uploadForm = z.object({ file: z.instanceof(File) });

// Each upload costs a decode and an encode, so it gets a budget of its own
// on top of the API-wide limits.
const uploadRateLimit = createRateLimiter({
  prefix: "rl:upload",
  windowMs: 60_000,
  max: 30,
  keyFn: sessionOrIpKey,
});

// The API-wide body limit skips this route (see src/index.ts); this is its
// own, sized for a file rather than a JSON payload.
const uploadBodyLimit = bodyLimit({
  maxSize: UPLOAD_BODY_LIMIT,
  onError: (c) =>
    c.json(
      {
        error: `Uploads must be ${formatMegabytes(UPLOAD_BODY_LIMIT)} or smaller`,
        code: "PAYLOAD_TOO_LARGE",
      } satisfies ApiErrorBody,
      413,
    ),
});

export const uploadRouter = new Hono<AppEnv>()
  /**
   * Multipart upload with a single `file` field.
   *
   * Images are decoded, oriented, resized to fit 2048px and stored as WebP;
   * voice notes are verified by their bytes and stored as-is. The browser
   * compresses images before sending (to save students' mobile data), but
   * this is the authoritative step: whatever the client sent, only a genuine,
   * bounded image or recording is stored.
   */
  .post(
    "/",
    requireAuth,
    uploadRateLimit,
    uploadBodyLimit,
    zValidator("form", uploadForm, zodErrorHook),
    async (c) => {
      const { file } = c.req.valid("form");
      // The declared type only picks the pipeline; each pipeline checks the
      // bytes for itself.
      const isImage = file.type.startsWith("image/");
      const maxBytes = isImage ? IMAGE_MAX_INPUT_BYTES : AUDIO_MAX_BYTES;

      if (file.size > maxBytes) {
        return fail(
          c,
          413,
          "PAYLOAD_TOO_LARGE",
          `${isImage ? "Images" : "Recordings"} must be ${formatMegabytes(maxBytes)} or smaller`,
        );
      }

      const input = new Uint8Array(await file.arrayBuffer());

      let media: Awaited<ReturnType<typeof processImage>>;
      try {
        media = isImage ? await processImage(input) : processAudio(input);
      } catch (err) {
        if (err instanceof MediaError) {
          return fail(c, 400, "VALIDATION_FAILED", err.message);
        }
        throw err;
      }

      const stored = await c.var.di.get("upload").store(c.var.user.id, media);
      return c.json(
        {
          url: stored.url,
          key: stored.key,
          contentType: media.contentType,
          width: media.width,
          height: media.height,
        },
        201,
      );
    },
  )
  // Serves development uploads. Refused in production and whenever real
  // storage is configured.
  .get("/local/*", async (c) => {
    const uploads = c.var.di.get("upload");
    if (env.NODE_ENV === "production" || uploads.isConfigured) {
      return fail(c, 404, "NOT_FOUND", "Not found");
    }

    const key = decodeURIComponent(
      c.req.path.slice(`${LOCAL_UPLOAD_ROUTE}/`.length),
    );
    const file = uploads.readLocal(key);
    if (!file || !(await file.exists())) {
      return fail(c, 404, "NOT_FOUND", "Not found");
    }

    const extension = key.slice(key.lastIndexOf(".") + 1);
    return new Response(file, {
      headers: {
        "content-type": CONTENT_TYPE_BY_EXTENSION[extension] ?? "application/octet-stream",
        "x-content-type-options": "nosniff",
        "cache-control": "private, max-age=3600",
      },
    });
  });
