import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { solverProfiles } from "../db/schema";
import type { AuthType } from "../lib/auth";
import type { AppEnv } from "../lib/di";
import type { AppRole, statement } from "../lib/permissions";

type NonNull<T> = { [P in keyof T]-?: NonNullable<T[P]> };

type AuthenticatedEnv = {
	Variables: NonNull<AuthType>;
} & AppEnv;

export const requireAuth = createMiddleware<AuthenticatedEnv>(async (c, next) => {
	const sessionData = await c.var.di.get("auth").api.getSession({
		headers: c.req.raw.headers,
	});

	if (!sessionData) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	c.set("user", sessionData.user);
	c.set("session", sessionData.session);
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
		// deny, not a silent grant of student-level access (see Part 1 #4 —
		// this previously defaulted a null role to "student").
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
 * Fetches its own session (doesn't assume a prior middleware populated
 * c.get("user") — mounting this alone used to 500 on `user.id`), and
 * destructures `.success` from the result (the previous version checked
 * truthiness of the whole `{ error, success }` object, which is always
 * truthy — the check could never fail).
 */
export const requirePermission = (permissions: PermissionCheck) =>
	createMiddleware<AuthenticatedEnv>(async (c, next) => {
		const authInstance = c.var.di.get("auth");
		const sessionData = await authInstance.api.getSession({
			headers: c.req.raw.headers,
		});

		if (!sessionData) {
			return c.json({ error: "Unauthorized" }, 401);
		}

		const result = await authInstance.api.userHasPermission({
			body: {
				userId: sessionData.user.id,
				permissions,
			},
			request: c.req.raw,
		});

		if (!result.success) {
			throw new HTTPException(403, {
				message: "Forbidden: You do not possess the required permissions.",
			});
		}

		c.set("user", sessionData.user);
		c.set("session", sessionData.session);
		await next();
	});

/**
 * Gates the prototype's "admin solver" powers on the main site (override a
 * lock, delete any question/solution/comment/thread message). This is
 * deliberately NOT part of the AC/requirePermission system: `user.role`
 * only ever holds "student" | "solver" | "staff", so there is no role value
 * an admin solver could have that AC could key off — the elevation lives on
 * solver_profiles.isAdminSolver instead, and this middleware checks it
 * directly against the database.
 */
export const requireAdminSolver = createMiddleware<AuthenticatedEnv>(async (c, next) => {
	const authInstance = c.var.di.get("auth");
	const sessionData = await authInstance.api.getSession({
		headers: c.req.raw.headers,
	});

	if (!sessionData) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	if (sessionData.user.role !== "solver") {
		return c.json({ error: "Forbidden: Admin-solver access required" }, 403);
	}

	const db = c.var.di.get("db");
	const profile = await db.query.solverProfiles.findFirst({
		where: eq(solverProfiles.userId, sessionData.user.id),
		columns: { isAdminSolver: true },
	});

	if (!profile?.isAdminSolver) {
		return c.json({ error: "Forbidden: Admin-solver access required" }, 403);
	}

	c.set("user", sessionData.user);
	c.set("session", sessionData.session);
	await next();
});
