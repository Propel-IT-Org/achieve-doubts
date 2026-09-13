import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { requireRole } from "../../middleware/auth";
import {
	createSolutionSchema,
	solutionParamSchema,
} from "./solutions.schema";

export const solutionsRouter = new Hono<AppEnv>()
	.get("/doubt/:doubtId", zValidator("param", solutionParamSchema), async (c) => {
		const { doubtId } = c.req.valid("param");
		const items = await c.var.di.get("solutions").getSolutionsByDoubtId(doubtId);
		return c.json(items);
	})
	.post(
		"/",
		requireRole(["solver", "admin"]),
		zValidator("json", createSolutionSchema),
		async (c) => {
			const user = c.var.user;
			const input = c.req.valid("json");
			const result = await c.var.di
				.get("solutions")
				.submitSolutionAtomic(user.id, input);

			if (!result) {
				return c.json(
					{ error: "Cannot submit solution: lock expired or not held by user" },
					403,
				);
			}

			c.var.di.get("feed").broadcast("DOUBT_RESOLVED", {
				doubtId: result.doubt.id,
				solverId: user.id,
			});

			return c.json(result, 201);
		},
	);