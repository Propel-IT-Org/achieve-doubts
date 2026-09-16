import { inferdiHono } from "@inferdi/hono";
import { Hono } from "hono";
import type { BunWebSocketData } from "hono/bun";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env";
import { startLockSweeper } from "./jobs/lock-sweeper";
import { type AppContainer, type AppEnv, container } from "./lib/di";
import { requireAuth, requirePermission } from "./middleware/auth";
import { createRateLimiter } from "./middleware/rate-limit";
import { adminRouter } from "./modules/admin/admin.router";
import { authRouter } from "./modules/auth/auth.router";
import { commentsRouter } from "./modules/interaction/comments.router";
import { notificationsRouter } from "./modules/interaction/notifications.router";
import { solutionsRouter } from "./modules/interaction/solutions.router";
import { threadRouter } from "./modules/interaction/thread.router";
import { profilesRouter } from "./modules/profiles/profiles.router";
import { questionsRouter } from "./modules/questions/questions.router";
import { reportsRouter } from "./modules/reports/reports.router";
import { taxonomyRouter } from "./modules/taxonomy/taxonomy.router";
import { uploadRouter } from "./modules/upload/upload.router";
import { getServer, websocket } from "./ws/hub";

export function createApp(customContainer: AppContainer = container) {
  const app = new Hono<AppEnv>();

  app.use("*", requestId());
  app.use("*", logger());
  app.use("*", secureHeaders());
  app.use(
    "*",
    bodyLimit({
      // Uploads go through presigned URLs, not this API — 5MB comfortably
      // covers JSON payloads for every route we serve directly.
      maxSize: 5 * 1024 * 1024,
      onError: (c) => c.json({ error: "Request body too large" }, 413),
    }),
  );
  app.use(
    "*",
    cors({
      origin: [
        env.CORS_ORIGIN,
        env.ADMIN_ORIGIN,
        "http://localhost:5173",
        "http://localhost:3000",
      ],
      credentials: true,
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Achieve-Auth",
        "Cookie",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
    }),
  );

  // Coarse defense-in-depth for the whole API. Individual sensitive routes
  // (e.g. the Achieve integration handshake) layer a stricter limiter on top.
  app.use("/api/*", createRateLimiter({ windowMs: 60_000, max: 300 }));

  app.use(
    "*",
    inferdiHono({
      container: customContainer,
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

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      // A route that supplied its own Response (e.g. a redirect) wins as-is.
      if (err.res) return err.res;
      return c.json({ error: err.message }, err.status);
    }
    console.error("[unhandled]", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.notFound((c) => c.json({ error: "Not found" }, 404));

  return (
    app
      .basePath("/api")
      .get("/healthz", (c) => c.json({ ok: true }))
      .route("/auth", authRouter)
      .route("/upload", uploadRouter)
      .route("/subjects", taxonomyRouter)
      // Four routers share the /questions prefix: the lifecycle itself plus
      // the solution/thread/comment sub-resources hanging off /:id.
      .route("/questions", questionsRouter)
      .route("/questions", solutionsRouter)
      .route("/questions", threadRouter)
      .route("/questions", commentsRouter)
      .route("/me/notifications", notificationsRouter)
      // Reports and profiles declare their own full paths (/me/reports,
      // /students/:id, /stats/home, ...), so they mount at the API root.
      .route("/", reportsRouter)
      .route("/", profilesRouter)
      .route("/admin", adminRouter)
  );
}

const app = createApp();

export type AppType = typeof app;

// Returning expired locks to the feed is a background concern, not a
// request-scoped one. It gets no FeedHub here because the hub publishes
// through the per-request Bun server handle — the sweep still flips status,
// records the lock event and notifies the asker; connected clients pick the
// change up on their next feed read.
if (env.NODE_ENV !== "test") {
  startLockSweeper(container.get("db"));
}

export default {
  port: env.PORT,
  fetch: app.fetch,
  websocket,
};
