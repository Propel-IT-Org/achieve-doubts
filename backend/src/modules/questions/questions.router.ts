import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import type { BlankInput } from "hono/types";
import type { AppEnv } from "../../lib/di";
import {
  optionalAuth,
  requireAuth,
  requirePermission,
} from "../../middleware/auth";
import { upgradeWebSocket } from "../../ws/hub";
import { isOwnUploadUrl } from "../upload/upload.util";
import {
  createQuestionSchema,
  listQuestionsQuerySchema,
  questionIdParamSchema,
} from "./questions.schema";

export const questionsRouter = new Hono<AppEnv>()
  .get(
    "/",
    optionalAuth,
    zValidator("query", listQuestionsQuerySchema),
    async (c) => {
      const query = c.req.valid("query");

      // `mine` is the only filter that needs an identity; everything else is
      // guest-readable.
      if (query.mine && !c.var.user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const result = await c.var.di
        .get("questions")
        .listQuestionsFeed(query, c.var.user?.id);
      return c.json(result);
    },
  )
  .post(
    "/",
    requireAuth,
    requirePermission({ question: ["create"] }),
    zValidator("json", createQuestionSchema),
    async (c) => {
      const input = c.req.valid("json");

      // A client can't attach an arbitrary URL — it has to be one our own
      // presign flow handed out.
      if (input.photoUrl && !isOwnUploadUrl(input.photoUrl)) {
        return c.json(
          { error: "photoUrl must be a URL returned by the upload presign flow" },
          400,
        );
      }

      const result = await c.var.di
        .get("questions")
        .createQuestion(c.var.user.id, input);

      if (!result.ok) {
        const message =
          result.reason === "daily"
            ? "Daily question limit reached"
            : "Monthly question limit reached";
        return c.json({ error: message }, 403);
      }

      c.var.di
        .get("feed")
        .broadcast("QUESTION_CREATED", { questionId: result.question.id });
      return c.json(result.question, 201);
    },
  )
  // Static segments must be registered before the generic "/:id" below, or
  // "open"/"feed" would match as an :id.
  .get("/open/count", requirePermission({ question: ["claim"] }), async (c) => {
    const value = await c.var.di.get("questions").countOpenQuestions();
    return c.json({ count: value });
  })
  .get(
    "/feed/ws",
    requirePermission({ question: ["claim"] }),
    upgradeWebSocket((c: Context<AppEnv, "/feed/ws", BlankInput>) => {
      const feedHub = c.var.di.get("feed");
      return {
        onOpen(_event, ws) {
          feedHub.subscribe(ws.raw);
        },
        onClose(_event, ws) {
          feedHub.unsubscribe(ws.raw);
        },
        onError(_event, ws) {
          feedHub.unsubscribe(ws.raw);
        },
      };
    }),
  )
  .get(
    "/:id",
    optionalAuth,
    zValidator("param", questionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const viewer = c.var.user;

      const question = await c.var.di.get("questions").getQuestionById(id, {
        includePrivate: Boolean(viewer),
        isStaff: viewer?.role === "staff",
      });

      if (!question) return c.json({ error: "Question not found" }, 404);
      return c.json(question);
    },
  )
  .post(
    "/:id/lock",
    requireAuth,
    requirePermission({ question: ["claim"] }),
    zValidator("param", questionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await c.var.di
        .get("questions")
        .lockQuestion(id, c.var.user.id);

      if (!result.ok) {
        if (result.reason === "followup_block") {
          return c.json(
            { error: "Answer your open follow-ups before locking new questions" },
            403,
          );
        }
        return c.json(
          {
            error: "Question is already locked or no longer available",
            status: result.current?.status ?? null,
            solverId: result.current?.solverId ?? null,
          },
          409,
        );
      }

      c.var.di.get("feed").broadcast("QUESTION_LOCKED", {
        questionId: result.question.id,
        solverId: c.var.user.id,
      });
      return c.json(result.question);
    },
  )
  .post(
    "/:id/unlock",
    requireAuth,
    requirePermission({ question: ["release"] }),
    zValidator("param", questionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await c.var.di
        .get("questions")
        .unlockQuestion(id, c.var.user.id);

      if (!result.ok) {
        return c.json(
          { error: "You do not hold the active lock for this question" },
          403,
        );
      }

      c.var.di
        .get("feed")
        .broadcast("QUESTION_UNLOCKED", { questionId: result.question.id });
      return c.json(result.question);
    },
  )
  .post(
    "/:id/override",
    requireAuth,
    requirePermission({ question: ["override"] }),
    zValidator("param", questionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await c.var.di
        .get("questions")
        .overrideQuestion(id, c.var.user.id);

      if (!result.ok) {
        return c.json({ error: "Question is not currently assigned" }, 409);
      }

      c.var.di.get("feed").broadcast("QUESTION_OVERRIDDEN", {
        questionId: result.question.id,
        solverId: c.var.user.id,
      });
      return c.json(result.question);
    },
  )
  .delete(
    "/:id",
    requireAuth,
    requirePermission({ question: ["delete"] }),
    zValidator("param", questionIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await c.var.di
        .get("questions")
        .softDeleteQuestion(id, c.var.user.id);

      if (!result.ok) return c.json({ error: "Question not found" }, 404);
      return c.json(result.question);
    },
  );
