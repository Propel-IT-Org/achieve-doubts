import { createMiddleware } from "hono/factory";
import { auth, type Session, type User } from "../lib/auth";
import type { AppRole } from "../lib/permissions";

export type AuthVariables = {
	user: User | null;
	session: Session | null;
};

export const authContextMiddleware = createMiddleware<{
	Variables: AuthVariables;
}>(async (c, next) => {
	const sessionData = await auth.api.getSession({
		headers: c.req.raw.headers,
	});

	c.set("user", sessionData?.user ?? null);
	c.set("session", sessionData?.session ?? null);
	await next();
});

export const requireAuth = createMiddleware<{
	Variables: { user: User; session: Session };
}>(async (c, next) => {
	const sessionData = await auth.api.getSession({
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
	return createMiddleware<{
		Variables: { user: User; session: Session };
	}>(async (c, next) => {
		const sessionData = await auth.api.getSession({
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
