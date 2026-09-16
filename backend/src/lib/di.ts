import type { InferdiHonoScopeEnv } from "@inferdi/hono";
import { Container } from "@inferdi/inferdi";
import type { BunWebSocketData } from "hono/bun";
import { createDatabase } from "../db";
import { AdminService } from "../modules/admin/admin.service";
import { CommentsService } from "../modules/interaction/comments.service";
import { NotificationsService } from "../modules/interaction/notifications.service";
import { SolutionsService } from "../modules/interaction/solutions.service";
import { ThreadService } from "../modules/interaction/thread.service";
import { QuestionsService } from "../modules/questions/questions.service";
import { ReportsService } from "../modules/reports/reports.service";
import { UploadService } from "../modules/upload/upload.service";
import { FeedHub } from "../ws/hub";
import { createAuth } from "./auth";

export function buildContainer() {
	return new Container()
		.registerFactory("db", createDatabase)
		.registerFactory("auth", (c) => createAuth(c.get("db")), ["db"])
		.registerClass("upload", UploadService, [])
		.registerClass("questions", QuestionsService, ["db"])
		.registerClass("solutions", SolutionsService, ["db"])
		.registerClass("thread", ThreadService, ["db"])
		.registerClass("comments", CommentsService, ["db"])
		.registerClass("notifications", NotificationsService, ["db"])
		.registerClass("reports", ReportsService, ["db"])
		.registerClass("admin", AdminService, ["db", "auth"])
		.declareScopeInputs<{ ws: Bun.ServerWebSocket<BunWebSocketData> }>()
		.registerClass("feed", FeedHub, ["ws"], "scoped");
}

export const container = buildContainer();

export type AppContainer = ReturnType<typeof buildContainer>;
export type AppEnv = InferdiHonoScopeEnv<
	ReturnType<
		typeof container.createScope<{ ws: Bun.ServerWebSocket<BunWebSocketData> }>
	>
>;
