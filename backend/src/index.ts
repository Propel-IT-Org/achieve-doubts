import { inferdiHono } from "@inferdi/hono";
import { APIError } from "better-auth/api";
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
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { type ApiErrorBody, codeForStatus, toErrorBody } from "./lib/errors";
import { type AppContainer, type AppEnv, container } from "./lib/di";
import { isDraining } from "./lib/lifecycle";
import { createRateLimiter, sessionOrIpKey } from "./middleware/rate-limit";
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
  app.use(
    "*",
    logger((...rest) =>
      !rest[0].includes("/api/healthz") ? console.log(...rest) : void 0,
    ),
  );
  app.use("*", secureHeaders());
  app.use(
    "*",
    bodyLimit({
      // Every route receives JSON only — files go straight to the bucket —
      // so 5 MB is generous.
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
        // Local dev servers only. In production these would let any page a
        // user happens to run on localhost make credentialed API calls.
        ...(env.NODE_ENV === "production"
          ? []
          : ["http://localhost:5173", "http://localhost:3000"]),
      ],
      credentials: true,
      // Auth rides on cookies, and the Achieve handshake is server-to-server
      // (no CORS), so JSON's Content-Type is the only header to allow.
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "DELETE"],
      maxAge: 600,
    }),
  );

  // Two tiers. Students on mobile carriers share addresses behind CGNAT, so a
  // per-IP limit alone would throttle whole neighbourhoods at once: signed-in
  // traffic is limited per session instead, and the per-IP ceiling is far
  // higher, catching only floods (including clients that rotate fake session
  // cookies to dodge tier two).
  //
  // The Achieve handshake is exempt from both. Every student's login arrives
  // from Achieve's few server addresses, so these limits would cap the whole
  // platform's logins; auth.router.ts gives it its own limiter.
  const skipAchieveHandshake = (c: { req: { path: string } }) =>
    c.req.path.startsWith("/api/auth/achieve/sessions/");
  app.use(
    "/api/*",
    createRateLimiter({
      prefix: "rl:ip",
      windowMs: 60_000,
      max: 3_000,
      skip: skipAchieveHandshake,
    }),
  );
  app.use(
    "/api/*",
    createRateLimiter({
      prefix: "rl:client",
      windowMs: 60_000,
      max: 300,
      keyFn: sessionOrIpKey,
      skip: skipAchieveHandshake,
    }),
  );

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

    // better-auth's own errors (banUser on a missing user, a refused
    // setRole, ...) carry a real status. Without this they'd fall through to
    // the generic branch below and surface as a 500.
    if (err instanceof APIError && err.statusCode >= 400) {
      const status = err.statusCode as ContentfulStatusCode;
      return c.json(
        {
          error: String(err.body?.message ?? err.message),
          code: codeForStatus(status),
          requestId,
        } satisfies ApiErrorBody,
        status,
      );
    }

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
export type { FeedEvent, FeedMessage } from "./ws/hub";

// Returning expired locks to the feed is a background concern, not a
// request-scoped one; it publishes through ws/hub.ts's module-level handle.
if (env.NODE_ENV !== "test") {
  startLockSweeper(container.get("db"));
}

export default {
  port: env.PORT,
  fetch: app.fetch,
  websocket,
};
