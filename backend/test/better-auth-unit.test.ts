import { describe, expect, it } from "bun:test";
import { createBetterAuthTest } from "./helpers/auth-test-utils";

describe("Better-Auth Test Utils - Unit Tests", () => {
	it("createUser factory creates user object with defaults", async () => {
		const { test } = await createBetterAuthTest();

		const defaultUser = test.createUser();
		expect(defaultUser).toHaveProperty("id");
		expect(defaultUser).toHaveProperty("email");
		expect(defaultUser).toHaveProperty("name");
		expect(defaultUser.emailVerified).toBe(true);
	});

	it("createUser factory allows overriding specific user fields", async () => {
		const { test } = await createBetterAuthTest();

		const customUser = test.createUser({
			name: "Sarah Connor",
			email: "sarah@resistance.org",
			role: "admin",
		});

		expect(customUser.name).toBe("Sarah Connor");
		expect(customUser.email).toBe("sarah@resistance.org");
		expect(customUser.role).toBe("admin");
	});

	it("saveUser persists user in Drizzle mock and deleteUser removes them", async () => {
		const { test, users } = await createBetterAuthTest();

		const userObj = test.createUser({
			name: "Unit Mock User",
			email: "unit_mock@test.com",
		});

		const saved = await test.saveUser(userObj);
		expect(saved.id).toBe(userObj.id);

		const inMockDb = users.get(saved.id);
		expect(inMockDb).toBeDefined();
		expect(inMockDb?.email).toBe("unit_mock@test.com");

		await test.deleteUser(saved.id);

		const afterDelete = users.get(saved.id);
		expect(afterDelete).toBeUndefined();
	});
});