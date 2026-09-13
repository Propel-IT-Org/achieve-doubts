import { zValidator } from "@hono/zod-validator";
import { type Context, Hono } from "hono";
import type { BlankInput } from "hono/types";
import type { AppEnv } from "../../lib/di";
import { appCheckMiddleware } from "../../middleware/app-check";
import { requireRole } from "../../middleware/auth";
import { upgradeWebSocket } from "../../ws/hub";
import {
	createDoubtSchema,
	doubtIdParamSchema,
	listDoubtsQuerySchema,
} from "./doubts.schema";

export const doubtsRouter = new Hono<AppEnv>()
	.get("/", zValidator("query", listDoubtsQuerySchema), async (c) => {
		const query = c.req.valid("query");
		const result = await c.var.di.get("doubts").listDoubtsFeed(query);
		return c.json(result);
	})
	.get("/:id", zValidator("param", doubtIdParamSchema), async (c) => {
		const { id } = c.req.valid("param");
		const doubt = await c.var.di.get("doubts").getDoubtById(id);
		if (!doubt) {
			return c.json({ error: "Doubt not found" }, 404);
		}
		return c.json(doubt);
	})
	.post(
		"/",
		requireRole(["student", "admin"]),
		appCheckMiddleware,
		zValidator("json", createDoubtSchema),
		async (c) => {
			const user = c.var.user;
			const input = c.req.valid("json");
			const created = await c.var.di.get("doubts").createDoubt(user.id, input);

			c.var.di.get("feed").broadcast("DOUBT_CREATED", { doubtId: created.id });
			return c.json(created, 201);
		},
	)
	.post(
		"/:id/claim",
		requireRole(["solver", "admin"]),
		appCheckMiddleware,
		zValidator("param", doubtIdParamSchema),
		async (c) => {
			const user = c.var.user;
			const { id } = c.req.valid("param");
			const claimed = await c.var.di
				.get("doubts")
				.claimDoubtAtomic(id, user.id);

			if (!claimed) {
				return c.json(
					{ error: "Doubt is already locked or no longer available" },
					409,
				);
			}

			c.var.di.get("feed").broadcast("DOUBT_LOCKED", {
				doubtId: claimed.id,
				solverId: user.id,
			});
			return c.json(claimed);
		},
	)
	.post(
		"/:id/release",
		requireRole(["solver", "admin"]),
		zValidator("param", doubtIdParamSchema),
		async (c) => {
			const user = c.var.user;
			const { id } = c.req.valid("param");
			const released = await c.var.di
				.get("doubts")
				.releaseDoubtAtomic(id, user.id);

			if (!released) {
				return c.json(
					{ error: "You do not hold the active lock for this doubt" },
					403,
				);
			}

			c.var.di
				.get("feed")
				.broadcast("DOUBT_UNLOCKED", { doubtId: released.id });
			return c.json(released);
		},
	)
	.get(
		"/feed/ws",
		requireRole(["solver", "admin"]),
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
	);
