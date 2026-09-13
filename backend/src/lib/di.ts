import type { InferdiHonoScopeEnv } from "@inferdi/hono";
import { Container } from "@inferdi/inferdi";
import type { BunWebSocketData } from "hono/bun";
import { createDatabase } from "../db";
import { AttestationService } from "../modules/attestation/attestation.service";
import { DoubtService } from "../modules/doubts/doubts.service";
import { SolutionService } from "../modules/solutions/solutions.service";
import { UploadService } from "../modules/upload/upload.service";
import { FeedHub } from "../ws/hub";
import { auth } from "./auth";

export const container = new Container()
	.registerValue("config", { version: "v1" })
	.registerValue("auth", auth)
	.registerFactory("db", createDatabase)
	.registerClass("doubts", DoubtService, ["db"])
	.registerClass("solutions", SolutionService, ["db"])
	.registerClass("upload", UploadService, [])
	.registerClass("attestation", AttestationService, [])
	.declareScopeInputs<{ ws: Bun.ServerWebSocket<BunWebSocketData> }>()
	.registerClass("feed", FeedHub, ["ws"], "scoped");

export type AppEnv = InferdiHonoScopeEnv<
	ReturnType<
		typeof container.createScope<{ ws: Bun.ServerWebSocket<BunWebSocketData> }>
	>
>;