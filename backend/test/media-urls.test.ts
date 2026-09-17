import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { env } from "../src/env";
import { requireOwnMedia } from "../src/middleware/media-urls";
import { createMockAuth } from "./helpers/mock-auth";
import { createTestClient } from "./helpers/test-client";

const base = env.S3_PUBLIC_URL.replace(/\/+$/, "");
const ownImage = `${base}/uploads/student-u1/1700000000000-${crypto.randomUUID()}.webp`;
const student = createMockAuth({ id: "student-u1", role: "student" });

/** A bare app with only this middleware, so no database is involved. */
function appWith(auth: ReturnType<typeof createMockAuth>) {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("di" as never, { get: () => auth } as never);
    await next();
  });
  app.use("*", requireOwnMedia as never);
  app.post("/echo", async (c) => c.json(await c.req.json()));
  return app;
}

const post = (app: Hono, body: unknown) =>
  app.request("/echo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("requireOwnMedia", () => {
  it("lets the caller's own upload through, with the body still readable", async () => {
    const body = { text: "see photo", imageUrl: ownImage };
    const res = await post(appWith(student), body);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(body);
  });

  it("ignores bodies without attachment fields", async () => {
    const res = await post(appWith(student), { text: "no media" });
    expect(res.status).toBe(200);
  });

  it("rejects an external URL", async () => {
    const res = await post(appWith(student), {
      imageUrl: "https://tracker.example/pixel.webp",
    });
    expect(res.status).toBe(400);
  });

  it("rejects an image URL in an audio field", async () => {
    const res = await post(appWith(student), { audioUrl: ownImage });
    expect(res.status).toBe(400);
  });

  it("leaves signed-out requests for the route's own auth check", async () => {
    const res = await post(appWith(createMockAuth(null)), {
      imageUrl: "https://tracker.example/pixel.webp",
    });
    expect(res.status).toBe(200);
  });
});

describe("requireOwnMedia, mounted on the API", () => {
  it("rejects another user's photo before the question route runs", async () => {
    const client = createTestClient({ auth: student });
    const res = await client.api.questions.$post({
      json: {
        subjectId: "phy",
        bookId: "phy1",
        chapterId: 1,
        text: "A question long enough to pass validation",
        photoUrl: ownImage.replace("student-u1", "someone-else"),
      },
    });
    expect(res.status as number).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("uploaded here");
  });
});
