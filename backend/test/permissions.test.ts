import { inferdiHono } from "@inferdi/hono";
import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../src/lib/di";
import { buildContainer } from "../src/lib/di";
import { requireAdminSolver, requirePermission, requireRole } from "../src/middleware/auth";

/**
 * Regression coverage for the bugs the original permission guards shipped
 * with (Part 1 #1-#4 of the audit):
 *   - requirePermission's `if (!hasPermission)` checked the truthiness of
 *     the whole `{ error, success }` result object, which is always
 *     truthy — the check could never fail.
 *   - requireRole defaulted a null/missing role to "student" instead of
 *     denying, silently granting student-level access to role-less users.
 * Neither had any test coverage, which is how both shipped.
 */

function makeApp(overrides: Record<string, unknown>) {
	let container = buildContainer();
	for (const [key, value] of Object.entries(overrides)) {
		container = container.override(key as never, value as never);
	}
	const app = new Hono<AppEnv>();
	app.use(
		"*",
		inferdiHono({
			container,
			createScope: (root) => root.createScope({ ws: undefined as never }),
		}),
	);
	return app;
}

function mockAuth(options: {
	user: { id: string; role: string | null } | null;
	permissionSuccess?: boolean;
}) {
	return {
		api: {
			getSession: async () =>
				options.user
					? { user: options.user, session: { id: "mock-session" } }
					: null,
			userHasPermission: async () => ({
				success: options.permissionSuccess ?? false,
				error: options.permissionSuccess ? null : "denied",
			}),
		},
	};
}

describe("requireRole", () => {
	it("denies an unauthenticated request", async () => {
		const app = makeApp({ auth: mockAuth({ user: null }) });
		app.get("/x", requireRole(["student"]), (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(401);
	});

	it("denies a session with a null role instead of defaulting to student", async () => {
		const app = makeApp({ auth: mockAuth({ user: { id: "u1", role: null } }) });
		app.get("/x", requireRole(["student"]), (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(403);
	});

	it("denies a role that isn't in the allow-list", async () => {
		const app = makeApp({ auth: mockAuth({ user: { id: "u1", role: "solver" } }) });
		app.get("/x", requireRole(["student"]), (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(403);
	});

	it("allows a role that matches the allow-list", async () => {
		const app = makeApp({ auth: mockAuth({ user: { id: "u1", role: "student" } }) });
		app.get("/x", requireRole(["student"]), (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(200);
	});
});

describe("requirePermission", () => {
	it("denies an unauthenticated request", async () => {
		const app = makeApp({ auth: mockAuth({ user: null }) });
		app.get("/x", requirePermission({ question: ["create"] }), (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(401);
	});

	it("denies when better-auth reports success: false — the check that could never fail before", async () => {
		const app = makeApp({
			auth: mockAuth({ user: { id: "u1", role: "student" }, permissionSuccess: false }),
		});
		app.get("/x", requirePermission({ question: ["create"] }), (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(403);
	});

	it("allows when better-auth reports success: true", async () => {
		const app = makeApp({
			auth: mockAuth({ user: { id: "u1", role: "student" }, permissionSuccess: true }),
		});
		app.get("/x", requirePermission({ question: ["create"] }), (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(200);
	});
});

describe("requireAdminSolver", () => {
	function mockDb(isAdminSolver: boolean | undefined) {
		return {
			query: {
				solverProfiles: {
					findFirst: async () =>
						isAdminSolver === undefined ? undefined : { isAdminSolver },
				},
			},
		};
	}

	it("denies a student outright, without querying the database", async () => {
		const app = makeApp({
			auth: mockAuth({ user: { id: "u1", role: "student" } }),
			db: mockDb(true),
		});
		app.get("/x", requireAdminSolver, (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(403);
	});

	it("denies a solver without the isAdminSolver flag", async () => {
		const app = makeApp({
			auth: mockAuth({ user: { id: "u1", role: "solver" } }),
			db: mockDb(false),
		});
		app.get("/x", requireAdminSolver, (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(403);
	});

	it("denies a solver with no profile row at all", async () => {
		const app = makeApp({
			auth: mockAuth({ user: { id: "u1", role: "solver" } }),
			db: mockDb(undefined),
		});
		app.get("/x", requireAdminSolver, (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(403);
	});

	it("allows a solver whose profile has isAdminSolver: true", async () => {
		const app = makeApp({
			auth: mockAuth({ user: { id: "u1", role: "solver" } }),
			db: mockDb(true),
		});
		app.get("/x", requireAdminSolver, (c) => c.json({ ok: true }));

		const res = await app.request("/x");
		expect(res.status).toBe(200);
	});
});
