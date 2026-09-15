import { createMiddleware } from "hono/factory";
import type { AuthType } from "../lib/auth";
import type { AppEnv } from "../lib/di";
import type { AppRole } from "../lib/permissions";

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
