import { zValidator } from "@hono/zod-validator";
import { codeForStatus, fail, zodErrorHook } from "../../lib/errors";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { parseIdParam } from "../interaction/shared";
import { createReportSchema } from "./reports.schema";

/**
 * Student-facing report endpoints. The staff-facing list/resolve pair lives
 * in modules/admin (same DI service), so the whole /admin surface can be
 * origin-restricted in one place.
 */
export const reportsRouter = new Hono<AppEnv>()
  .post(
    "/questions/:id/reports",
    requireAuth,
    requirePermission({ report: ["create"] }),
    zValidator("json", createReportSchema, zodErrorHook),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return fail(c, 400, "VALIDATION_FAILED", "Invalid question id");

      const { reason, text } = c.req.valid("json");
      const result = await c.var.di
        .get("reports")
        .createReport(questionId, c.var.user.id, reason, text);

      if ("error" in result) {
        // The service picks the status (404 unknown question, 403 not the
        // asker, 409 already reported), so the code follows from it.
        const status = result.status ?? 400;
        return fail(
          c,
          status,
          codeForStatus(status),
          result.error ?? "Report could not be created",
        );
      }
      return c.json(result.report, 201);
    },
  )
  .get(
    "/me/reports",
    requireAuth,
    requirePermission({ report: ["list"] }),
    async (c) => {
      const rows = await c.var.di.get("reports").listMyReports(c.var.user.id);
      return c.json(rows);
    },
  );
