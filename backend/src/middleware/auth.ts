import { createMiddleware } from "hono/factory";
import type { AuthType } from "../lib/auth";
import { fail } from "../lib/errors";
import type { AppEnv } from "../lib/di";
import { type AppRole, roles, type statement } from "../lib/permissions";

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
      return fail(c, 401, "UNAUTHORIZED", "Unauthorized");
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

type Statement = typeof statement;
export type PermissionCheck = {
  [K in keyof Statement]?: Statement[K][number][];
};

/**
 * Granular permission guard: a route gates on the verb it needs
 * (`question: ["override"]`) rather than on a role list, so adding or
 * re-scoping a role is a change in permissions.ts alone.
 *
 * Chain it after {requireAuth}. It checks the role on the session that
 * middleware already loaded against the same access-control table
 * better-auth uses, instead of fetching the session a second time. A null or
 * unknown role is denied, never treated as a default.
 */
export const requirePermission = (permissions: PermissionCheck) =>
  createMiddleware<AuthenticatedEnv>(async (c, next) => {
    const user = c.var.user as AuthType["user"] | undefined;
    if (!user) return fail(c, 401, "UNAUTHORIZED", "Unauthorized");

    const role =
      user.role && Object.hasOwn(roles, user.role)
        ? roles[user.role as AppRole]
        : null;
    if (!role?.authorize(permissions).success) {
      return fail(
        c,
        403,
        "FORBIDDEN",
        "Forbidden: You do not possess the required permissions.",
      );
    }

    await next();
  });
