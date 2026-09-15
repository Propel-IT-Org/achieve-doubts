import { createMiddleware } from "hono/factory";
import type { AuthType } from "../lib/auth";
import type { AppEnv } from "../lib/di";
import type { AppRole, statement } from "../lib/permissions";
import { HTTPException } from "hono/http-exception";

type AuthContextEnv = {
  Variables: AuthType;
} & AppEnv;

type NonNull<T> = { [P in keyof T]-?: NonNullable<T[P]> };

type AuthenticatedEnv = {
  Variables: NonNull<AuthType>;
} & AppEnv;

export const authContextMiddleware = createMiddleware<AuthContextEnv>(
  async (c, next) => {
    const sessionData = await c.var.di.get("auth").api.getSession({
      headers: c.req.raw.headers,
    });

    c.set("user", sessionData?.user ?? null);
    c.set("session", sessionData?.session ?? null);
    await next();
  },
);

export const requireAuth = createMiddleware<AuthenticatedEnv>(
  async (c, next) => {
    const sessionData = await c.var.di.get("auth").api.getSession({
      headers: c.req.raw.headers,
    });

    if (!sessionData) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("user", sessionData.user);
    c.set("session", sessionData.session);
    await next();
  },
);

export function requireRole(allowedRoles: AppRole[]) {
  return createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const authInstance = c.var.di.get("auth");
    const sessionData = await authInstance.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!sessionData) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const userRole = (sessionData.user.role || "student") as AppRole;
    if (!allowedRoles.includes(userRole)) {
      return c.json({ error: "Forbidden: Insufficient permissions" }, 403);
    }

    c.set("user", sessionData.user);
    c.set("session", sessionData.session);
    await next();
  });
}

type Statement = typeof statement;
export type PermissionCheck = {
  [K in keyof Statement]?: Statement[K][number][];
};
/**
 * 2. Granular Permission Guard Middleware Factory
 * Checks whether the current user has the required action(s) on the entity.
 */
export const requirePermission = (permissions: PermissionCheck) =>
  createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const user = c.get("user");
    const auth = c.var.di.get("auth");

    // Server-side permission check via Better Auth API
    const hasPermission = await auth.api.userHasPermission({
      body: {
        userId: user.id,
        permissions,
      },
      request: c.req.raw,
    });

    if (!hasPermission) {
      throw new HTTPException(403, {
        message: "Forbidden: You do not possess the required permissions.",
      });
    }

    await next();
  });
