import { fail } from "../../lib/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { createCommentSchema } from "./comments.schema";
import { parseIdParam, validateMediaUrls, zodErrorHook } from "./shared";

export const commentsRouter = new Hono<AppEnv>()
  // Public: guests can read the discussion even though they can't post.
  .get("/:id/comments", async (c) => {
    const questionId = parseIdParam(c.req.param("id"));
    if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

    const comments = await c.var.di.get("comments").listComments(questionId);
    return c.json({ comments });
  })
  .post(
    "/:id/comments",
    requireAuth,
    // Solvers deliberately lack comment:create — the public thread is for
    // students; solvers reply in the private follow-up thread instead. That
    // rule lives in permissions.ts, so this route needs no role check.
    requirePermission({ comment: ["create"] }),
    zValidator("json", createCommentSchema, zodErrorHook),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

      const input = c.req.valid("json");
      const mediaError = validateMediaUrls(input);
      if (mediaError) return fail(c, 400, "VALIDATION_FAILED", mediaError);

      const result = await c.var.di
        .get("comments")
        .createComment(questionId, c.var.user.id, input);

      if ("error" in result) return fail(c, 404, "NOT_FOUND", "Question not found");
      return c.json({ comment: result.comment }, 201);
    },
  )
  .delete(
    "/:id/comments/:cid",
    requireAuth,
    requirePermission({ comment: ["delete"] }),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      const commentId = parseIdParam(c.req.param("cid"));
      if (!questionId || !commentId) return fail(c, 400, "VALIDATION_FAILED", "Invalid id");

      const comment = await c.var.di
        .get("comments")
        .deleteComment(questionId, commentId, c.var.user.id);

      if (!comment) return fail(c, 404, "NOT_FOUND", "Comment not found");
      return c.json({ comment });
    },
  );
