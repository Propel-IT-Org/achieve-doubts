import { describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { buildContainer } from "../src/lib/di";

describe("SolutionService Unit Tests with Drizzle Mock & InferDI Override", () => {
	it("submits solution atomically when solver holds active lock", async () => {
		const mockDb = drizzle.mock({ schema });

		const mockTx = {
			select: () => ({
				from: () => ({
					where: async () => [
						{ id: 50, solverId: "solver-1", status: "LOCKED" },
					],
				}),
			}),
			insert: () => ({
				values: (vals: Record<string, unknown>) => ({
					returning: async () => [
						{
							id: 1,
							doubtId: vals.doubtId,
							solverId: vals.solverId,
							content: vals.content,
						},
					],
				}),
			}),
			update: () => ({
				set: (vals: Record<string, unknown>) => ({
					where: () => ({
						returning: async () => [
							{
								id: 50,
								status: vals.status,
							},
						],
					}),
				}),
			}),
		};

		mockDb.transaction = (async (cb: (tx: unknown) => unknown) =>
			cb(mockTx)) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("solutions");

		const result = await service.submitSolutionAtomic("solver-1", {
			doubtId: 50,
			content: "Here is the comprehensive step-by-step solution.",
		});

		expect(result).not.toBeNull();
		expect(result?.solution?.id).toBe(1);
		expect(result?.doubt?.status).toBe("RESOLVED");
	});

	it("returns null when solver does not hold lock for the doubt", async () => {
		const mockDb = drizzle.mock({ schema });

		const mockTx = {
			select: () => ({
				from: () => ({
					where: async () => [],
				}),
			}),
		};

		mockDb.transaction = (async (cb: (tx: unknown) => unknown) =>
			cb(mockTx)) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("solutions");

		const result = await service.submitSolutionAtomic("wrong-solver", {
			doubtId: 50,
			content: "Attempting solution without active lock.",
		});

		expect(result).toBeNull();
	});

	it("retrieves solutions by doubt id", async () => {
		const mockDb = drizzle.mock({ schema });
		const mockSolutions = [
			{
				id: 1,
				doubtId: 50,
				content: "Answer 1",
				solver: { id: "s1", name: "Solver 1", role: "solver" },
			},
		];

		mockDb.query.solutions.findMany = (async () => mockSolutions) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("solutions");

		const solutions = await service.getSolutionsByDoubtId(50);

		expect(solutions.length).toBe(1);
		expect(solutions[0]?.id).toBe(1);
		expect(solutions[0]?.solver.id).toBe("s1");
	});
});
