import { zValidator } from "@hono/zod-validator";
import { fail, zodErrorHook } from "../../lib/errors";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { parseIdParam } from "../interaction/shared";
import { adminReportsQuerySchema } from "../reports/reports.schema";
import {
  activeBodySchema,
  createBatchSchema,
  createSolverSchema,
  payoutSnapshotSchema,
  quotaSchema,
  rangeQuerySchema,
  rankingsQuerySchema,
  solverAdminFlagSchema,
  studentSearchQuerySchema,
} from "./admin.schema";

/**
 * Staff-only admin panel. Every route is gated by a `requirePermission`
 * check against permissions.ts — only the `staff` role holds these verbs.
 */
export const adminRouter = new Hono<AppEnv>()
  // ---------- reports ----------
  .get(
    "/reports",
    requireAuth,
    requirePermission({ report: ["resolve"] }),
    zValidator("query", adminReportsQuerySchema, zodErrorHook),
    async (c) => {
      const rows = await c.var.di
        .get("reports")
        .listAdminReports(c.req.valid("query"));
      return c.json(rows);
    },
  )
  .post(
    "/reports/:id/resolve",
    requireAuth,
    requirePermission({ report: ["resolve"] }),
    async (c) => {
      const id = parseIdParam(c.req.param("id"));
      if (!id) return fail(c, 400, "VALIDATION_FAILED", "Invalid report id");

      const result = await c.var.di
        .get("reports")
        .resolveReport(id, c.var.user.id);
      if (result.error) return fail(c, 404, "NOT_FOUND", result.error);
      return c.json(result.report);
    },
  )
  // ---------- students ----------
  .get(
    "/students",
    requireAuth,
    requirePermission({ studentProfile: ["list"] }),
    zValidator("query", studentSearchQuerySchema, zodErrorHook),
    async (c) => {
      const { q, limit, offset } = c.req.valid("query");
      const rows = await c.var.di.get("admin").listStudents(q, limit, offset);
      return c.json(rows);
    },
  )
  .get(
    "/students/:id",
    requireAuth,
    requirePermission({ studentProfile: ["list"] }),
    async (c) => {
      const row = await c.var.di.get("admin").getStudent(c.req.param("id"));
      if (!row) return fail(c, 404, "NOT_FOUND", "Student not found");
      return c.json(row);
    },
  )
  .post(
    "/students/:id/active",
    requireAuth,
    requirePermission({ studentProfile: ["update"] }),
    zValidator("json", activeBodySchema, zodErrorHook),
    async (c) => {
      const { active } = c.req.valid("json");
      const result = await c.var.di.get("admin").setUserActive({
        userId: c.req.param("id"),
        active,
        expectedRoles: ["student"],
        headers: c.req.raw.headers,
        actorId: c.var.user.id,
      });
      if ("error" in result) {
        return result.error === "self"
          ? fail(c, 409, "CONFLICT", "You can't change your own account's status")
          : fail(c, 404, "NOT_FOUND", "Student not found");
      }
      return c.json({ ok: true, active });
    },
  )
  // ---------- solvers ----------
  .get(
    "/solvers",
    requireAuth,
    requirePermission({ solverProfile: ["list"] }),
    async (c) => {
      return c.json(await c.var.di.get("admin").listSolvers());
    },
  )
  .post(
    "/solvers",
    requireAuth,
    requirePermission({ solverProfile: ["create"] }),
    zValidator("json", createSolverSchema, zodErrorHook),
    async (c) => {
      const result = await c.var.di
        .get("admin")
        .createSolver(c.req.valid("json"), c.req.raw.headers, c.var.user.id);

      if (result.error) return fail(c, 409, "CONFLICT", result.error);
      return c.json(result.solver, 201);
    },
  )
  .post(
    "/solvers/:id/active",
    requireAuth,
    requirePermission({ solverProfile: ["update"] }),
    zValidator("json", activeBodySchema, zodErrorHook),
    async (c) => {
      const { active } = c.req.valid("json");
      const result = await c.var.di.get("admin").setUserActive({
        userId: c.req.param("id"),
        active,
        expectedRoles: ["solver", "adminSolver"],
        headers: c.req.raw.headers,
        actorId: c.var.user.id,
      });
      if ("error" in result) {
        return result.error === "self"
          ? fail(c, 409, "CONFLICT", "You can't change your own account's status")
          : fail(c, 404, "NOT_FOUND", "Solver not found");
      }
      return c.json({ ok: true, active });
    },
  )
  .post(
    "/solvers/:id/admin",
    requireAuth,
    requirePermission({ solverProfile: ["update"] }),
    zValidator("json", solverAdminFlagSchema, zodErrorHook),
    async (c) => {
      const { isAdminSolver } = c.req.valid("json");
      const result = await c.var.di
        .get("admin")
        .setSolverAdmin(
          c.req.param("id"),
          isAdminSolver,
          c.req.raw.headers,
          c.var.user.id,
        );
      if ("error" in result) {
        return fail(c, 404, "NOT_FOUND", "Solver not found");
      }
      return c.json({ ok: true, isAdminSolver });
    },
  )
  // ---------- batches ----------
  .get(
    "/batches",
    requireAuth,
    requirePermission({ batch: ["list"] }),
    async (c) => c.json(await c.var.di.get("admin").listBatches()),
  )
  .post(
    "/batches",
    requireAuth,
    requirePermission({ batch: ["create"] }),
    zValidator("json", createBatchSchema, zodErrorHook),
    async (c) => {
      const { id, label } = c.req.valid("json");
      const result = await c.var.di
        .get("admin")
        .createBatch(id, label, c.var.user.id);
      if (result.error) return fail(c, 409, "CONFLICT", result.error);
      return c.json(result.batch, 201);
    },
  )
  .post(
    "/batches/:id/active",
    requireAuth,
    requirePermission({ batch: ["update"] }),
    zValidator("json", activeBodySchema, zodErrorHook),
    async (c) => {
      const { active } = c.req.valid("json");
      const result = await c.var.di
        .get("admin")
        .setBatchActive(
          c.req.param("id"),
          active,
          c.req.raw.headers,
          c.var.user.id,
        );

      if (result.error) return fail(c, 404, "NOT_FOUND", result.error);
      return c.json({
        batch: result.batch,
        affectedStudents: result.affectedStudents,
      });
    },
  )
  // ---------- quota ----------
  .get(
    "/quota",
    requireAuth,
    requirePermission({ batch: ["list"] }),
    async (c) => c.json(await c.var.di.get("admin").getQuota()),
  )
  .put(
    "/quota",
    requireAuth,
    requirePermission({ batch: ["update"] }),
    zValidator("json", quotaSchema, zodErrorHook),
    async (c) => {
      const row = await c.var.di
        .get("admin")
        .setQuota(c.req.valid("json"), c.var.user.id);
      return c.json(row);
    },
  )
  // ---------- analytics ----------
  .get(
    "/analytics",
    requireAuth,
    requirePermission({ analytics: ["list"] }),
    zValidator("query", rangeQuerySchema, zodErrorHook),
    async (c) => c.json(await c.var.di.get("admin").analytics(c.req.valid("query"))),
  )
  .get(
    "/analytics/rankings",
    requireAuth,
    requirePermission({ analytics: ["list"] }),
    zValidator("query", rankingsQuerySchema, zodErrorHook),
    async (c) => {
      const { minAnswered, ...range } = c.req.valid("query");
      return c.json(await c.var.di.get("admin").rankings(range, minAnswered));
    },
  )
  // ---------- payouts ----------
  .get(
    "/payouts",
    requireAuth,
    requirePermission({ payout: ["list"] }),
    zValidator("query", rangeQuerySchema, zodErrorHook),
    async (c) => {
      const { from, to } = c.req.valid("query");
      if (from && to) {
        return c.json(await c.var.di.get("admin").payoutPreview(from, to));
      }
      return c.json(await c.var.di.get("admin").listPayouts());
    },
  )
  .post(
    "/payouts",
    requireAuth,
    requirePermission({ payout: ["generate"] }),
    zValidator("json", payoutSnapshotSchema, zodErrorHook),
    async (c) => {
      const { from, to, note } = c.req.valid("json");
      const result = await c.var.di
        .get("admin")
        .snapshotPayout(from, to, note, c.var.user.id);
      return c.json(result, 201);
    },
  )
  .post(
    "/payouts/:id/paid",
    requireAuth,
    requirePermission({ payout: ["markPaid"] }),
    async (c) => {
      const id = parseIdParam(c.req.param("id"));
      if (!id) return fail(c, 400, "VALIDATION_FAILED", "Invalid payout id");

      const result = await c.var.di
        .get("admin")
        .markPayoutPaid(id, c.var.user.id);
      if (result.error) return fail(c, 404, "NOT_FOUND", result.error);
      return c.json(result.period);
    },
  );
