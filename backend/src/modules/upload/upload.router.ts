import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/di";
import { zodErrorHook } from "../../lib/errors";
import { requireAuth } from "../../middleware/auth";
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

export const uploadRouter = new Hono<AppEnv>().post(
  "/presign",
  requireAuth,
  zValidator("json", presignSchema, zodErrorHook),
  async (c) => {
    const { contentType, size } = c.req.valid("json");
    return c.json(
      await c.var.di.get("upload").presign(contentType, size, c.var.user.id),
    );
  },
);
