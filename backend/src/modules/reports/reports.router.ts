import { zValidator } from "@hono/zod-validator";
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
    zValidator("json", createReportSchema),
    async (c) => {
      const questionId = parseIdParam(c.req.param("id"));
      if (!questionId) return c.json({ error: "Invalid question id" }, 400);

      const { reason, text } = c.req.valid("json");
      const result = await c.var.di
        .get("reports")
        .createReport(questionId, c.var.user.id, reason, text);

      if ("error" in result) {
        return c.json({ error: result.error }, result.status);
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
