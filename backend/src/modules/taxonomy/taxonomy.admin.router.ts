import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { fail, zodErrorHook } from "../../lib/errors";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { parseIdParam } from "../interaction/shared";
import {
	createBookSchema,
	createChapterSchema,
	createLevelSchema,
	createSubjectSchema,
	updateBookSchema,
	updateChapterSchema,
	updateLevelSchema,
	updateSubjectSchema,
} from "./taxonomy.schema";

/**
 * Staff editing of the syllabus tree: classes, subjects, books, chapters.
 * Reading it stays public (GET /api/taxonomy) — this is the write side, and
 * every route is gated on a `taxonomy` verb from permissions.ts.
 *
 * A row a question is already filed under can't be deleted, and neither can
 * a class that still has subjects or batches; those refusals come back as
 * 409s naming what is in the way.
 */

/** "…not found" is a 404; everything else the services refuse is a 409. */
function refuse(c: Parameters<typeof fail>[0], message: string) {
	return /not found/i.test(message)
		? fail(c, 404, "NOT_FOUND", message)
		: fail(c, 409, "CONFLICT", message);
}

export const taxonomyAdminRouter = new Hono<AppEnv>()
	// ---------- classes ----------
	.post(
		"/levels",
		requireAuth,
		requirePermission({ taxonomy: ["create"] }),
		zValidator("json", createLevelSchema, zodErrorHook),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.createLevel(c.req.valid("json"), c.var.user.id);
			return c.json(result.row, 201);
		},
	)
	.patch(
		"/levels/:id",
		requireAuth,
		requirePermission({ taxonomy: ["update"] }),
		zValidator("json", updateLevelSchema, zodErrorHook),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.updateLevel(c.req.param("id"), c.req.valid("json"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json(result.row);
		},
	)
	.delete(
		"/levels/:id",
		requireAuth,
		requirePermission({ taxonomy: ["delete"] }),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.deleteLevel(c.req.param("id"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json({ ok: true });
		},
	)
	// ---------- subjects ----------
	.post(
		"/subjects",
		requireAuth,
		requirePermission({ taxonomy: ["create"] }),
		zValidator("json", createSubjectSchema, zodErrorHook),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.createSubject(c.req.valid("json"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json(result.row, 201);
		},
	)
	.patch(
		"/subjects/:id",
		requireAuth,
		requirePermission({ taxonomy: ["update"] }),
		zValidator("json", updateSubjectSchema, zodErrorHook),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.updateSubject(c.req.param("id"), c.req.valid("json"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json(result.row);
		},
	)
	.delete(
		"/subjects/:id",
		requireAuth,
		requirePermission({ taxonomy: ["delete"] }),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.deleteSubject(c.req.param("id"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json({ ok: true });
		},
	)
	// ---------- books ----------
	.post(
		"/books",
		requireAuth,
		requirePermission({ taxonomy: ["create"] }),
		zValidator("json", createBookSchema, zodErrorHook),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.createBook(c.req.valid("json"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json(result.row, 201);
		},
	)
	.patch(
		"/books/:id",
		requireAuth,
		requirePermission({ taxonomy: ["update"] }),
		zValidator("json", updateBookSchema, zodErrorHook),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.updateBook(c.req.param("id"), c.req.valid("json"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json(result.row);
		},
	)
	.delete(
		"/books/:id",
		requireAuth,
		requirePermission({ taxonomy: ["delete"] }),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.deleteBook(c.req.param("id"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json({ ok: true });
		},
	)
	// ---------- chapters ----------
	.post(
		"/chapters",
		requireAuth,
		requirePermission({ taxonomy: ["create"] }),
		zValidator("json", createChapterSchema, zodErrorHook),
		async (c) => {
			const result = await c.var.di
				.get("taxonomy")
				.createChapter(c.req.valid("json"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json(result.row, 201);
		},
	)
	.patch(
		"/chapters/:id",
		requireAuth,
		requirePermission({ taxonomy: ["update"] }),
		zValidator("json", updateChapterSchema, zodErrorHook),
		async (c) => {
			const id = parseIdParam(c.req.param("id"));
			if (id === null) return fail(c, 400, "VALIDATION_FAILED", "Invalid chapter id");

			const result = await c.var.di
				.get("taxonomy")
				.updateChapter(id, c.req.valid("json"), c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json(result.row);
		},
	)
	.delete(
		"/chapters/:id",
		requireAuth,
		requirePermission({ taxonomy: ["delete"] }),
		async (c) => {
			const id = parseIdParam(c.req.param("id"));
			if (id === null) return fail(c, 400, "VALIDATION_FAILED", "Invalid chapter id");

			const result = await c.var.di
				.get("taxonomy")
				.deleteChapter(id, c.var.user.id);
			if (result.error) return refuse(c, result.error);
			return c.json({ ok: true });
		},
	);
