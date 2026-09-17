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
import { type ApiErrorBody, toErrorBody } from "./lib/errors";
import { type AppContainer, type AppEnv, container } from "./lib/di";
import { isDraining } from "./lib/lifecycle";
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
      onError: (c) =>
        c.json(
          {
            error: "Request body too large",
            code: "PAYLOAD_TOO_LARGE",
          } satisfies ApiErrorBody,
          413,
        ),
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

  // Root error handling. Every failure that escapes a handler — thrown
  // HTTPException/AppError, better-auth's APIError, or an outright bug —
  // leaves through here as one ApiErrorBody, so the client only ever parses
  // a single error shape.
  app.onError((err, c) => {
    // A route that supplied its own Response (e.g. a redirect) wins as-is.
    if (err instanceof HTTPException && err.res) return err.res;

    const requestId = c.get("requestId");
    const body = toErrorBody(err, requestId);

    // 5xx means we did something wrong: log it with the request id so a
    // user-reported failure can be traced back to this line.
    if (body.code === "INTERNAL_ERROR") {
      console.error(`[unhandled] requestId=${requestId ?? "-"}`, err);
    }

    const status = err instanceof HTTPException ? err.status : 500;
    return c.json(body, status);
  });

  app.notFound((c) =>
    c.json(
      {
        error: `No route for ${c.req.method} ${new URL(c.req.url).pathname}`,
        code: "NOT_FOUND",
        requestId: c.get("requestId"),
      } satisfies ApiErrorBody,
      404,
    ),
  );

  return (
    app
      .basePath("/api")
      // 503 while draining, so Traefik and the container health check take
      // this replica out of rotation before it stops. See src/main.ts.
      .get("/healthz", (c) =>
        isDraining()
          ? c.json({ ok: false, draining: true }, 503)
          : c.json({ ok: true, draining: false }),
      )
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
