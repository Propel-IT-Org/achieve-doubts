import { describe, expect, it } from "bun:test";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestClient } from "../helpers/test-client";

describe("API Route: /api/doubts", () => {
	it("GET /api/doubts returns feed items with pagination cursor", async () => {
		const mockDoubtService = {
			listDoubtsFeed: async () => ({
				items: [{ id: 1, title: "Test Doubt", status: "UNLOCKED" }],
				nextCursor: null,
			}),
		};

		const client = createTestClient({ doubts: mockDoubtService });
		const res = await client.api.doubts.$get({ query: { limit: "10" } });

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.items.length).toBe(1);
		expect(data.nextCursor).toBeNull();
	});

	it("GET /api/doubts/:id returns 200 if found or 404 if not found", async () => {
		const mockDoubtService = {
			getDoubtById: async (id: number) => {
				if (id === 1) return { id: 1, title: "Found Doubt" };
				return null;
			},
		};

		const client = createTestClient({ doubts: mockDoubtService });

		const okRes = await client.api.doubts[":id"].$get({ param: { id: "1" } });
		expect(okRes.status).toBe(200);

		const notFoundRes = await client.api.doubts[":id"].$get({ param: { id: "999" } });
		expect(notFoundRes.status).toBe(404);
	});

	it("POST /api/doubts validates student role and creates doubt", async () => {
		const mockDoubtService = {
			createDoubt: async (userId: string, input: { title: string; description: string; subject: string }) => ({
				id: 10,
				studentId: userId,
				...input,
				status: "UNLOCKED",
			}),
		};

		const studentClient = createTestClient({
			auth: createMockAuth({ id: "student-1", role: "student" }),
			doubts: mockDoubtService,
		});

		const res = await studentClient.api.doubts.$post({
			json: {
				title: "Calculus Limits",
				description: "How to evaluate lim x->0 sin(x)/x?",
				subject: "Mathematics",
			},
		});

		expect(res.status).toBe(201);
		const data = await res.json();
		expect(data.id).toBe(10);
		expect(data.studentId).toBe("student-1");

		const solverClient = createTestClient({
			auth: createMockAuth({ id: "solver-1", role: "solver" }),
			doubts: mockDoubtService,
		});

		const forbiddenRes = await solverClient.api.doubts.$post({
			json: {
				title: "Forbidden Doubt",
				description: "Solver should not create doubts",
				subject: "Physics",
			},
		});

		expect(forbiddenRes.status).toBe(403);
	});

	it("POST /api/doubts/:id/claim handles solver claims and conflicts", async () => {
		const mockDoubtService = {
			claimDoubtAtomic: async (id: number, solverId: string) => {
				if (id === 10) return { id: 10, status: "LOCKED", solverId };
				return null;
			},
		};

		const client = createTestClient({
			auth: createMockAuth({ id: "solver-1", role: "solver" }),
			doubts: mockDoubtService,
		});

		const claimRes = await client.api.doubts[":id"].claim.$post({
			param: { id: "10" },
		});
		expect(claimRes.status).toBe(200);

		const conflictRes = await client.api.doubts[":id"].claim.$post({
			param: { id: "99" },
		});
		expect(conflictRes.status).toBe(409);
	});

	it("POST /api/doubts/:id/release handles lock release", async () => {
		const mockDoubtService = {
			releaseDoubtAtomic: async (id: number) => {
				if (id === 10) return { id: 10, status: "UNLOCKED", solverId: null };
				return null;
			},
		};

		const client = createTestClient({
			auth: createMockAuth({ id: "solver-1", role: "solver" }),
			doubts: mockDoubtService,
		});

		const releaseRes = await client.api.doubts[":id"].release.$post({
			param: { id: "10" },
		});
		expect(releaseRes.status).toBe(200);

		const forbiddenRes = await client.api.doubts[":id"].release.$post({
			param: { id: "99" },
		});
		expect(forbiddenRes.status).toBe(403);
	});
});