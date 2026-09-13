import { describe, expect, it } from "bun:test";
import { createTestClient } from "../helpers/test-client";

describe("API Route: /api/auth", () => {
	it("delegates auth route requests to Better-Auth handler", async () => {
		let handled = false;
		const mockAuth = {
			handler: async (_req: Request) => {
				handled = true;
				return new Response(JSON.stringify({ status: "ok" }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			},
			api: {
				getSession: async () => null,
			},
		};

		const client = createTestClient({ auth: mockAuth });
		const res = await client.api.auth.$get();

		expect(res.status).toBe(200);
		expect(handled).toBe(true);
	});
});