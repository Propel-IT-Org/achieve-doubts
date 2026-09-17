import { fail, zodErrorHook } from "../../lib/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { parseIdParam } from "./shared";
import { createSolutionSchema, ratingSchema } from "./solutions.schema";

/** Roles allowed to delete someone else's solution, not just their own. */
function canModerate(role: string | null | undefined): boolean {
  return role === "adminSolver" || role === "staff";
}

export const solutionsRouter = new Hono<AppEnv>()
  .post(
    "/:id/solution",
    requireAuth,
    requirePermission({ solution: ["create"] }),
    zValidator("json", createSolutionSchema, zodErrorHook),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

      const input = c.req.valid("json");

      const result = await c.var.di
        .get("solutions")
        .submitSolution(c.var.user.id, questionId, input);

      if ("error" in result) {
        if (result.error === "lock") {
          return fail(
            c,
            403,
            "FORBIDDEN",
            "Cannot submit solution: lock expired or not held by you",
          );
        }
        return fail(c, 409, "CONFLICT", "This question already has a solution");
      }

      c.var.di
        .get("feed")
        .broadcast("QUESTION_ANSWERED", { questionId: result.question.id });

      return c.json({ solution: result.solution, question: result.question }, 201);
    },
  )
  .delete(
    "/:id/solution",
    requireAuth,
    requirePermission({ solution: ["delete"] }),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

      const result = await c.var.di
        .get("solutions")
        .deleteSolution(questionId, c.var.user.id, canModerate(c.var.user.role));

      if ("error" in result) {
        if (result.error === "not_found") {
          return fail(c, 404, "NOT_FOUND", "Solution not found");
        }
        return fail(c, 403, "FORBIDDEN", "Forbidden: not your solution");
      }

      return c.json({ question: result.question });
    },
  )
  .post(
    "/:id/rating",
    requireAuth,
    requirePermission({ rating: ["create"] }),
    zValidator("json", ratingSchema, zodErrorHook),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

      const { value } = c.req.valid("json");
      const result = await c.var.di
        .get("solutions")
        .rateQuestion(questionId, c.var.user.id, value);

      if ("error" in result) {
        if (result.error === "not_found") {
          return fail(c, 404, "NOT_FOUND", "Question not found");
        }
        if (result.error === "forbidden") {
          return fail(c, 403, "FORBIDDEN", "Only the asker can rate this question");
        }
        return fail(c, 400, "VALIDATION_FAILED", "This question has not been answered yet");
      }

      return c.json({ question: result.question });
    },
  );
