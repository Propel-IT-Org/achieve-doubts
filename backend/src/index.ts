import { inferdiHono } from "@inferdi/hono";
import { Hono } from "hono";
import type { BunWebSocketData } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./env";
import { type AppEnv, container } from "./lib/di";
import { attestationRouter } from "./modules/attestation/attestation.router";
import { authRouter } from "./modules/auth/auth.router";
import { doubtsRouter } from "./modules/doubts/doubts.router";
import { solutionsRouter } from "./modules/solutions/solutions.router";
import { uploadRouter } from "./modules/upload/upload.router";
import { getServer, websocket } from "./ws/hub";

const baseApp = new Hono<AppEnv>();

baseApp.use("*", logger());
baseApp.use(
	"*",
	cors({
		origin: [env.CORS_ORIGIN, "http://localhost:5173", "http://localhost:3000"],
		credentials: true,
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"X-App-Check-Token",
			"Cookie",
		],
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		exposeHeaders: ["Content-Length"],
		maxAge: 600,
	}),
);

baseApp.use(
	"*",
	inferdiHono({
		container: container,
		createScope: (_root, c) => {
			let wsServer: Bun.ServerWebSocket<BunWebSocketData> | undefined;
			try {
				if (c.env && typeof c.env === "object") {
					wsServer = getServer(c);
				}
			} catch {
				// Safe in testClient/mock fetch mode
			}
			return _root.createScope({ ws: wsServer as never });
		},
	}),
);

const app = baseApp
	.basePath("/api")
	.route("/auth", authRouter)
	.route("/doubts", doubtsRouter)
	.route("/solutions", solutionsRouter)
	.route("/upload", uploadRouter)
	.route("/attestation", attestationRouter);

export type AppType = typeof app;

export default {
	port: env.PORT,
	fetch: app.fetch,
	websocket,
};
