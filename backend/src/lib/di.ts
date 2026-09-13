import type { InferdiHonoScopeEnv } from "@inferdi/hono";
import { Container } from "@inferdi/inferdi";
import type { BunWebSocketData } from "hono/bun";
import { createDatabase } from "../db";
import { AttestationService } from "../modules/attestation/attestation.service";
import { DoubtService } from "../modules/doubts/doubts.service";
import { SolutionService } from "../modules/solutions/solutions.service";
import { UploadService } from "../modules/upload/upload.service";
import { FeedHub } from "../ws/hub";
import { createAuth } from "./auth";

export function buildContainer() {
	return new Container()
		.registerFactory("config", () => ({ version: "v1" }))
		.registerFactory("db", createDatabase)
		.registerFactory("auth", (c) => createAuth(c.get("db")), ["db"])
		.registerClass("doubts", DoubtService, ["db"])
		.registerClass("solutions", SolutionService, ["db"])
		.registerClass("upload", UploadService, [])
		.registerClass("attestation", AttestationService, [])
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
