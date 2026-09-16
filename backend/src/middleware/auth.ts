import { createMiddleware } from "hono/factory";
import type { AuthType } from "../lib/auth";
import type { AppEnv } from "../lib/di";
import type { AppRole, statement } from "../lib/permissions";

type NonNull<T> = { [P in keyof T]-?: NonNullable<T[P]> };

type AuthenticatedEnv = {
  Variables: NonNull<AuthType>;
} & AppEnv;

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

/**
 * Optional session: populates `user`/`session` when one exists, never
 * rejects. For endpoints whose *response shape* changes for guests — e.g.
 * question detail, which hides the solution and follow-up thread when
 * nobody is signed in.
 */
export const optionalAuth = createMiddleware<
  AppEnv & { Variables: AuthType }
>(async (c, next) => {
  const sessionData = await c.var.di.get("auth").api.getSession({
    headers: c.req.raw.headers,
  });
  c.set("user", sessionData?.user ?? null);
  c.set("session", sessionData?.session ?? null);
  await next();
});

export function requireRole(allowedRoles: AppRole[]) {
  return createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const authInstance = c.var.di.get("auth");
    const sessionData = await authInstance.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!sessionData) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // No fallback to a default role: a null/unrecognised role is a hard
    // deny, not a silent grant of student-level access.
    const userRole = sessionData.user.role as AppRole | null | undefined;
    if (!userRole || !allowedRoles.includes(userRole)) {
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
 * Granular permission guard backed by better-auth's access-control API.
 * Destructures `.success` from the result — checking the whole
 * `{ error, success }` object's truthiness could never fail.
 *
 * This is the primary authorization mechanism: a route gates on the verb it
 * needs (`question: ["override"]`) rather than on a role list, so adding or
 * re-scoping a role is a change in permissions.ts alone.
 *
 * It does not populate `c.var.user`. If you need both permission and the
 * user record, chain {requireAuth} and {requirePermission} in that order.
 */
export const requirePermission = (permissions: PermissionCheck) =>
  createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const authInstance = c.var.di.get("auth");

    const result = await authInstance.api.userHasPermission({
      body: {
        permissions,
      },
      headers: c.req.raw.headers,
    });

    if (!result.success) {
      return c.json(
        { error: "Forbidden: You do not possess the required permissions." },
        403,
      );
    }

    await next();
  });
