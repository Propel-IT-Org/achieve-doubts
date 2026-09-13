import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import { feedHub } from "../../ws/hub";
import {
	createSolutionSchema,
	solutionParamSchema,
} from "./solutions.schema";
import {
	getSolutionsByDoubtId,
	submitSolutionAtomic,
} from "./solutions.service";

export const solutionsRouter = new Hono()
	.get("/doubt/:doubtId", zValidator("param", solutionParamSchema), async (c) => {
		const { doubtId } = c.req.valid("param");
		const items = await getSolutionsByDoubtId(doubtId);
		return c.json(items);
	})
	.post(
		"/",
		requireRole(["solver", "admin"]),
		zValidator("json", createSolutionSchema),
		async (c) => {
			const user = c.var.user;
			const input = c.req.valid("json");
			const result = await submitSolutionAtomic(user.id, input);

			if (!result) {
				return c.json(
					{ error: "Cannot submit solution: lock expired or not held by user" },
					403,
				);
			}

			feedHub.broadcast("DOUBT_RESOLVED", {
				doubtId: result.doubt.id,
				solverId: user.id,
			});

			return c.json(result, 201);
		},
	);
