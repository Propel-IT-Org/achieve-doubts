import { describe, expect, it } from "bun:test";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestClient } from "../helpers/test-client";

describe("API Route: /api/upload", () => {
	it("POST /api/upload/presign returns 401 when unauthenticated", async () => {
		const client = createTestClient({ auth: createMockAuth(null) });
		const res = await client.api.upload.presign.$post({
			json: { fileName: "question.jpg", contentType: "image/jpeg" },
		});

		expect(res.status).toBe(401);
	});

	it("POST /api/upload/presign returns presigned URLs when authenticated", async () => {
		const client = createTestClient({
			auth: createMockAuth({ id: "student-u1", role: "student" }),
		});

		const res = await client.api.upload.presign.$post({
			json: { fileName: "graph.png", contentType: "image/png" },
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toHaveProperty("uploadUrl");
		expect(data).toHaveProperty("publicUrl");
		expect(data).toHaveProperty("key");
		expect((data as { key: string }).key).toContain("student-u1");
	});

	it("PUT /api/upload/mock successfully acknowledges mock uploads", async () => {
		const client = createTestClient();
		const res = await client.api.upload.mock.$put({
			query: { key: "uploads/student-u1/graph.png" },
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(data.key).toBe("uploads/student-u1/graph.png");
	});
});