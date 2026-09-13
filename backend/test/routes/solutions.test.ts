import { describe, expect, it } from "bun:test";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestClient } from "../helpers/test-client";

describe("API Route: /api/solutions", () => {
	it("GET /api/solutions/doubt/:doubtId returns list of solutions", async () => {
		const mockSolutionsService = {
			getSolutionsByDoubtId: async (doubtId: number) => [
				{
					id: 1,
					doubtId,
					content: "Step 1: Factor out the common term...",
					solver: { id: "s1", name: "Solver 1" },
				},
			],
		};

		const client = createTestClient({ solutions: mockSolutionsService });
		const res = await client.api.solutions.doubt[":doubtId"].$get({
			param: { doubtId: "42" },
		});

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.length).toBe(1);
		expect(data[0].id).toBe(1);
		expect(data[0].doubtId).toBe(42);
	});

	it("POST /api/solutions enforces solver role and submits solution", async () => {
		const mockSolutionsService = {
			submitSolutionAtomic: async (
				solverId: string,
				input: { doubtId: number; content: string; attachmentUrl?: string },
			) => {
				if (input.doubtId === 42) {
					return {
						solution: { id: 100, solverId, ...input },
						doubt: { id: 42, status: "RESOLVED" },
					};
				}
				return null;
			},
		};

		const solverClient = createTestClient({
			auth: createMockAuth({ id: "solver-1", role: "solver" }),
			solutions: mockSolutionsService,
		});

		const okRes = await solverClient.api.solutions.$post({
			json: {
				doubtId: 42,
				content: "Complete step-by-step solution here",
			},
		});

		expect(okRes.status).toBe(201);
		const data = await okRes.json();
		expect(data.solution.id).toBe(100);
		expect(data.doubt.status).toBe("RESOLVED");

		const conflictRes = await solverClient.api.solutions.$post({
			json: {
				doubtId: 999,
				content: "Attempting solution without active lock",
			},
		});

		expect(conflictRes.status).toBe(403);

		const studentClient = createTestClient({
			auth: createMockAuth({ id: "student-1", role: "student" }),
			solutions: mockSolutionsService,
		});

		const forbiddenRes = await studentClient.api.solutions.$post({
			json: {
				doubtId: 42,
				content: "Student trying to answer doubt",
			},
		});

		expect(forbiddenRes.status).toBe(403);
	});
});