import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../lib/di";
import { fail } from "../lib/errors";
import { isOwnUpload } from "../modules/upload/upload.util";

/** Request-body fields that hold an attachment URL, and what each must be. */
const MEDIA_FIELDS = {
  photoUrl: "image",
  imageUrl: "image",
  audioUrl: "audio",
} as const;

/**
 * Attachment URLs anywhere in the API must be the caller's own uploads (see
 * isOwnUpload), checked once here instead of in every route that accepts
 * media.
 *
 * Mount it outside /api/auth: better-auth reads the raw request stream, which
 * parsing the body here would consume. Other routes are unaffected, because
 * Hono caches the parsed body for their validators.
 */
export const requireOwnMedia = createMiddleware<AppEnv>(async (c, next) => {
  const isJsonWrite =
    c.req.method !== "GET" &&
    c.req.header("content-type")?.includes("application/json");
  if (!isJsonWrite) return next();

  // Malformed JSON is left for the route's own validator to report.
  const body = (await c.req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const attachments = Object.entries(MEDIA_FIELDS).filter(
    ([field]) => typeof body?.[field] === "string" && body[field] !== "",
  );
  if (attachments.length === 0) return next();

  const session = await c.var.di
    .get("auth")
    .api.getSession({ headers: c.req.raw.headers });
  // Signed out: the route's requireAuth answers with 401.
  if (!session) return next();

  const allOwn = attachments.every(([field, kind]) =>
    isOwnUpload(body?.[field] as string, session.user.id, kind),
  );
  if (!allOwn) {
    return fail(
      c,
      400,
      "VALIDATION_FAILED",
      "Attachments must be files you uploaded here",
    );
  }
  await next();
});
