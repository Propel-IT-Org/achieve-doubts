import type { InferdiHonoScopeEnv } from "@inferdi/hono";
import { Container } from "@inferdi/inferdi";
import type { BunWebSocketData } from "hono/bun";
import { createDatabase } from "../db";
import { DoubtService } from "../modules/doubts/doubts.service";
import { FeedHub } from "../ws/hub";

export const container = new Container()
	.registerValue("config", { version: "v1" })
	.registerFactory("db", createDatabase)
	.registerClass("doubts", DoubtService, ["db"])
	.declareScopeInputs<{ ws: Bun.ServerWebSocket<BunWebSocketData> }>()
	.registerClass("feed", FeedHub, ["ws"], "scoped");

export type AppEnv = InferdiHonoScopeEnv<
	ReturnType<
		typeof container.createScope<{ ws: Bun.ServerWebSocket<BunWebSocketData> }>
	>
>;
