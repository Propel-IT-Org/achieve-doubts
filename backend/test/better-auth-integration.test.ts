import { describe, expect, it } from "bun:test";
import { createBetterAuthTest } from "./helpers/auth-test-utils";
import { createTestClient } from "./helpers/test-client";

describe("Better-Auth Test Utils - Integration Tests", () => {
	it("login helper generates active session and auth headers", async () => {
		const { test } = await createBetterAuthTest();

		const userObj = await test.saveUser(
			test.createUser({ email: "session_mock@example.com" }),
		);

		const loginRes = await test.login({ userId: userObj.id });
		expect(loginRes.session).toBeDefined();
		expect(loginRes.token).toBeDefined();
		expect(loginRes.headers.get("cookie")).toContain(loginRes.token);

		const cookies = await test.getCookies({ userId: userObj.id });
		expect(cookies.length).toBeGreaterThan(0);
		expect(cookies[0].name).toBe("better-auth.session_token");

		await test.deleteUser(userObj.id);
	});

	it("authenticates real API endpoints via test.getAuthHeaders", async () => {
		const { auth, test } = await createBetterAuthTest();

		const student = await test.saveUser(
			test.createUser({
				name: "Integration Student",
				email: "integration_student@test.com",
				role: "student",
			}),
		);

		const headers = await test.getAuthHeaders({ userId: student.id });
		expect(headers.get("cookie")).toBeDefined();

		const client = createTestClient({ auth });
		const presignRes = await client.api.upload.presign.$post(
			{ json: { fileName: "graph.png", contentType: "image/png" } },
			{ headers: { cookie: headers.get("cookie") as string } },
		);

		expect(presignRes.status).toBe(200);
		const data = (await presignRes.json()) as { uploadUrl: string };
		expect(data.uploadUrl).toBeDefined();

		await test.deleteUser(student.id);
	});
});