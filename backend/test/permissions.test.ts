import { inferdiHono } from "@inferdi/hono";
import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../src/lib/di";
import { buildContainer } from "../src/lib/di";
import {
  optionalAuth,
  requirePermission,
  requireRole,
} from "../src/middleware/auth";

/**
 * Regression coverage for the permission guards:
 *   - requirePermission's `if (!hasPermission)` used to check the truthiness
 *     of the whole `{ error, success }` result object, which is always
 *     truthy — the check could never fail.
 *   - requireRole defaulted a null/missing role to "student" instead of
 *     denying, silently granting student access to role-less users.
 * Neither had coverage, which is how both shipped.
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

    expect((await app.request("/x")).status).toBe(401);
  });

  it("denies a session with a null role instead of defaulting to student", async () => {
    const app = makeApp({ auth: mockAuth({ user: { id: "u1", role: null } }) });
    app.get("/x", requireRole(["student"]), (c) => c.json({ ok: true }));

    expect((await app.request("/x")).status).toBe(403);
  });

  it("denies a role outside the allow-list", async () => {
    const app = makeApp({
      auth: mockAuth({ user: { id: "u1", role: "solver" } }),
    });
    app.get("/x", requireRole(["student"]), (c) => c.json({ ok: true }));

    expect((await app.request("/x")).status).toBe(403);
  });

  it("allows a matching role", async () => {
    const app = makeApp({
      auth: mockAuth({ user: { id: "u1", role: "student" } }),
    });
    app.get("/x", requireRole(["student"]), (c) => c.json({ ok: true }));

    expect((await app.request("/x")).status).toBe(200);
  });

  it("accepts adminSolver as a first-class role", async () => {
    const app = makeApp({
      auth: mockAuth({ user: { id: "u1", role: "adminSolver" } }),
    });
    app.get("/x", requireRole(["solver", "adminSolver"]), (c) =>
      c.json({ ok: true }),
    );

    expect((await app.request("/x")).status).toBe(200);
  });
});

describe("requirePermission", () => {
  it("denies when better-auth reports success: false — the check that could never fail before", async () => {
    const app = makeApp({
      auth: mockAuth({
        user: { id: "u1", role: "student" },
        permissionSuccess: false,
      }),
    });
    app.get("/x", requirePermission({ question: ["override"] }), (c) =>
      c.json({ ok: true }),
    );

    expect((await app.request("/x")).status).toBe(403);
  });

  it("allows when better-auth reports success: true", async () => {
    const app = makeApp({
      auth: mockAuth({
        user: { id: "u1", role: "adminSolver" },
        permissionSuccess: true,
      }),
    });
    app.get("/x", requirePermission({ question: ["override"] }), (c) =>
      c.json({ ok: true }),
    );

    expect((await app.request("/x")).status).toBe(200);
  });
});

describe("optionalAuth", () => {
  it("passes through as a guest without rejecting", async () => {
    const app = makeApp({ auth: mockAuth({ user: null }) });
    app.get("/x", optionalAuth, (c) => c.json({ guest: !c.var.user }));

    const res = await app.request("/x");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ guest: true });
  });

  it("populates the user when a session exists", async () => {
    const app = makeApp({
      auth: mockAuth({ user: { id: "u1", role: "student" } }),
    });
    app.get("/x", optionalAuth, (c) => c.json({ guest: !c.var.user }));

    expect(await (await app.request("/x")).json()).toEqual({ guest: false });
  });
});
