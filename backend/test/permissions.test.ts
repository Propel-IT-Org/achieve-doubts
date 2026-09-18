import { inferdiHono } from "@inferdi/hono";
import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../src/lib/di";
import { buildContainer } from "../src/lib/di";
import {
  optionalAuth,
  requireAuth,
  requirePermission,
} from "../src/middleware/auth";

/**
 * Regression coverage for the permission guard. It once checked the
 * truthiness of better-auth's whole `{ error, success }` result, which is
 * always truthy, so it could never fail; and a role-less user was once
 * treated as a student. Neither had coverage, which is how both shipped.
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

function mockAuth(user: { id: string; role: string | null } | null) {
  return {
    api: {
      getSession: async () =>
        user ? { user, session: { id: "mock-session" } } : null,
    },
  };
}

function guarded(user: { id: string; role: string | null } | null) {
  const app = makeApp({ auth: mockAuth(user) });
  app.get("/x", requireAuth, requirePermission({ question: ["override"] }), (c) =>
    c.json({ ok: true }),
  );
  return app;
}

describe("requirePermission", () => {
  it("rejects a guest with 401", async () => {
    expect((await guarded(null).request("/x")).status).toBe(401);
  });

  it("denies a role that lacks the verb", async () => {
    const res = await guarded({ id: "u1", role: "solver" }).request("/x");
    expect(res.status).toBe(403);
  });

  it("allows a role that holds the verb", async () => {
    const res = await guarded({ id: "u1", role: "adminSolver" }).request("/x");
    expect(res.status).toBe(200);
  });

  it("denies a null role instead of defaulting to student", async () => {
    const res = await guarded({ id: "u1", role: null }).request("/x");
    expect(res.status).toBe(403);
  });

  it("denies unknown roles, including inherited property names", async () => {
    for (const role of ["superuser", "constructor", "toString"]) {
      const res = await guarded({ id: "u1", role }).request("/x");
      expect(res.status).toBe(403);
    }
  });

  it("lets solvers comment, but not delete others' comments", async () => {
    const app = makeApp({ auth: mockAuth({ id: "u1", role: "solver" }) });
    app.get("/create", requireAuth, requirePermission({ comment: ["create"] }), (c) =>
      c.json({ ok: true }),
    );
    app.get("/delete", requireAuth, requirePermission({ comment: ["delete"] }), (c) =>
      c.json({ ok: true }),
    );
    expect((await app.request("/create")).status).toBe(200);
    expect((await app.request("/delete")).status).toBe(403);
  });

  it("requires every requested verb", async () => {
    const app = makeApp({ auth: mockAuth({ id: "u1", role: "student" }) });
    app.get(
      "/x",
      requireAuth,
      requirePermission({ question: ["create"], comment: ["delete"] }),
      (c) => c.json({ ok: true }),
    );
    expect((await app.request("/x")).status).toBe(403);
  });
});

describe("optionalAuth", () => {
  it("passes through as a guest without rejecting", async () => {
    const app = makeApp({ auth: mockAuth(null) });
    app.get("/x", optionalAuth, (c) => c.json({ guest: !c.var.user }));

    const res = await app.request("/x");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ guest: true });
  });

  it("populates the user when a session exists", async () => {
    const app = makeApp({ auth: mockAuth({ id: "u1", role: "student" }) });
    app.get("/x", optionalAuth, (c) => c.json({ guest: !c.var.user }));

    expect(await (await app.request("/x")).json()).toEqual({ guest: false });
  });
});
