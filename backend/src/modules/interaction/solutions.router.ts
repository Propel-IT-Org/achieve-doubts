import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { parseIdParam, validateMediaUrls, zodErrorHook } from "./shared";
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
      if (!questionId) return c.json({ error: "Invalid question id" }, 400);

      const input = c.req.valid("json");
      const mediaError = validateMediaUrls(input);
      if (mediaError) return c.json({ error: mediaError }, 400);

      const result = await c.var.di
        .get("solutions")
        .submitSolution(c.var.user.id, questionId, input);

      if ("error" in result) {
        if (result.error === "lock") {
          return c.json(
            { error: "Cannot submit solution: lock expired or not held by you" },
            403,
          );
        }
        return c.json({ error: "This question already has a solution" }, 409);
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
      if (!questionId) return c.json({ error: "Invalid question id" }, 400);

      const result = await c.var.di
        .get("solutions")
        .deleteSolution(questionId, c.var.user.id, canModerate(c.var.user.role));

      if ("error" in result) {
        if (result.error === "not_found") {
          return c.json({ error: "Solution not found" }, 404);
        }
        return c.json({ error: "Forbidden: not your solution" }, 403);
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
      if (!questionId) return c.json({ error: "Invalid question id" }, 400);

      const { value } = c.req.valid("json");
      const result = await c.var.di
        .get("solutions")
        .rateQuestion(questionId, c.var.user.id, value);

      if ("error" in result) {
        if (result.error === "not_found") {
          return c.json({ error: "Question not found" }, 404);
        }
        if (result.error === "forbidden") {
          return c.json({ error: "Only the asker can rate this question" }, 403);
        }
        return c.json({ error: "This question has not been answered yet" }, 400);
      }

      return c.json({ question: result.question });
    },
  );
