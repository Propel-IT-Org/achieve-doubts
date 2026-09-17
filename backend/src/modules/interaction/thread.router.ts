import { fail } from "../../lib/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { parseIdParam, zodErrorHook } from "./shared";
import { createThreadMessageSchema } from "./thread.schema";

export const threadRouter = new Hono<AppEnv>()
  .get(
    "/:id/thread",
    requireAuth,
    requirePermission({ thread: ["list"] }),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

      const service = c.var.di.get("thread");
      if (!(await service.hasActiveSolution(questionId))) {
        return c.json({ messages: [] });
      }

      return c.json({ messages: await service.listThread(questionId) });
    },
  )
  .post(
    "/:id/thread",
    requireAuth,
    requirePermission({ thread: ["create"] }),
    zValidator("json", createThreadMessageSchema, zodErrorHook),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

      const user = c.var.user;
      const service = c.var.di.get("thread");

      const question = await service.getQuestion(questionId);
      if (!question) return fail(c, 404, "NOT_FOUND", "Question not found");

      // Posting is limited to the two parties, regardless of role — a
      // permission alone can't express "this particular question's asker".
      const isAsker = question.askerId === user.id;
      const isSolver = question.solverId === user.id;
      if (!isAsker && !isSolver) {
        return fail(
          c,
          403,
          "FORBIDDEN",
          "Only the asker or the assigned solver may post here",
        );
      }

      if (!(await service.hasActiveSolution(questionId))) {
        return fail(
          c,
          400,
          "VALIDATION_FAILED",
          "The follow-up thread opens once a solution is submitted",
        );
      }

      const input = c.req.valid("json");

      const authorSide: "asker" | "solver" = isAsker ? "asker" : "solver";
      const notifyUserId = authorSide === "asker" ? question.solverId : null;

      const message = await service.postMessage(
        questionId,
        user.id,
        authorSide,
        input,
        notifyUserId,
      );

      return c.json({ message }, 201);
    },
  )
  .delete(
    "/:id/thread/:msgId",
    requireAuth,
    requirePermission({ thread: ["delete"] }),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      const msgId = parseIdParam(c.req.param("msgId"));
      if (!questionId || !msgId) return fail(c, 400, "VALIDATION_FAILED", "Invalid id");

      const message = await c.var.di
        .get("thread")
        .deleteMessage(questionId, msgId, c.var.user.id);

      if (!message) return fail(c, 404, "NOT_FOUND", "Thread message not found");
      return c.json({ message });
    },
  );
