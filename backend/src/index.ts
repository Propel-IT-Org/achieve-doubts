import { inferdiHono } from "@inferdi/hono";
import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { BlankInput } from "hono/types";
import { env } from "./env";
import { type AppEnv, container } from "./lib/di";
import { attestationRouter } from "./modules/attestation/attestation.router";
import { authRouter } from "./modules/auth/auth.router";
import { doubtsRouter } from "./modules/doubts/doubts.router";
import { solutionsRouter } from "./modules/solutions/solutions.router";
import { uploadRouter } from "./modules/upload/upload.router";
import { getServer, upgradeWebSocket, websocket } from "./ws/hub";

const app = new Hono<AppEnv>();

app.use("*", logger());
app.use(
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

app.use(
	"*",
	inferdiHono({
		container,
		createScope: (_root, c) => {
			return _root.createScope({ ws: getServer(c) });
		},
	}),
);

const routes = app
	.basePath("/api")
	.route("/auth", authRouter)
	.route("/doubts", doubtsRouter)
	.route("/solutions", solutionsRouter)
	.route("/upload", uploadRouter)
	.route("/attestation", attestationRouter);

export type AppType = typeof routes;

export default {
	port: env.PORT,
	fetch: app.fetch,
	websocket,
};
