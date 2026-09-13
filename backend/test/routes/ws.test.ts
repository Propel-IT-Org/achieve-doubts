import { describe, expect, it } from "bun:test";
import { websocket } from "../../src/ws/hub";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestApp } from "../helpers/test-client";

describe("WebSocket Route: /api/doubts/feed/ws", () => {
	it("receives real-time broadcast events when solver connects", async () => {
		const app = createTestApp({
			auth: createMockAuth({ id: "solver-1", role: "solver" }),
		});

		const server = Bun.serve({
			port: 0,
			fetch: app.fetch,
			websocket,
		});

		try {
			const ws = new WebSocket(
				`ws://localhost:${server.port}/api/doubts/feed/ws`,
			);

			const received = await new Promise<{ event: string; data: unknown }>(
				(resolve, reject) => {
					ws.onopen = () => {
						server.publish(
							"doubts:feed",
							JSON.stringify({
								event: "DOUBT_CREATED",
								data: { doubtId: 101 },
							}),
						);
					};
					ws.onmessage = (event) => {
						resolve(JSON.parse(event.data as string));
					};
					ws.onerror = (err) => reject(err);
				},
			);

			expect(received.event).toBe("DOUBT_CREATED");
			expect((received.data as { doubtId: number }).doubtId).toBe(101);

			ws.close();
		} finally {
			server.stop(true);
		}
	});

	it("rejects unauthorized WebSocket upgrade when unauthenticated", async () => {
		const app = createTestApp({
			auth: createMockAuth(null),
		});

		const server = Bun.serve({
			port: 0,
			fetch: app.fetch,
			websocket,
		});

		try {
			const res = await fetch(
				`http://localhost:${server.port}/api/doubts/feed/ws`,
				{
					headers: { Upgrade: "websocket" },
				},
			);
			expect(res.status).toBe(401);
		} finally {
			server.stop(true);
		}
	});

	it("rejects non-solver role from connecting to solver feed", async () => {
		const app = createTestApp({
			auth: createMockAuth({ id: "student-1", role: "student" }),
		});

		const server = Bun.serve({
			port: 0,
			fetch: app.fetch,
			websocket,
		});

		try {
			const res = await fetch(
				`http://localhost:${server.port}/api/doubts/feed/ws`,
				{
					headers: { Upgrade: "websocket" },
				},
			);
			expect(res.status).toBe(403);
		} finally {
			server.stop(true);
		}
	});
});