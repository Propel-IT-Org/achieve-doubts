import { describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { buildContainer } from "../src/lib/di";
import { DoubtService } from "../src/modules/doubts/doubts.service";
import { SolutionService } from "../src/modules/solutions/solutions.service";

describe("InferDI Container with .override()", () => {
	it("overrides db with drizzle.mock using buildContainer().override()", async () => {
		const mockDb = drizzle.mock({ schema });

		const c = buildContainer().override("db", mockDb as never);

		const doubts = c.get("doubts");
		const solutions = c.get("solutions");

		expect(doubts).toBeInstanceOf(DoubtService);
		expect(solutions).toBeInstanceOf(SolutionService);
	});

	it("executes service methods with overridden mock dependencies", async () => {
		const mockDb = drizzle.mock({ schema });
		mockDb.insert = (() => ({
			values: (vals: Record<string, unknown>) => ({
				returning: async () => [
					{
						id: 999,
						studentId: vals.studentId,
						title: vals.title,
						description: vals.description,
						subject: vals.subject,
						status: "UNLOCKED",
					},
				],
			}),
		})) as never;

		const c = buildContainer().override("db", mockDb as never);
		const doubtService = c.get("doubts");

		const created = await doubtService.createDoubt("student-di-override", {
			title: "Overridden DI Doubt",
			description: "Testing override pattern",
			subject: "Chemistry",
		});

		expect(created?.id).toBe(999);
		expect(created?.title).toBe("Overridden DI Doubt");
	});

	it("overrides multiple services in container chain", async () => {
		const mockDb = drizzle.mock({ schema });
		const mockConfig = { version: "v2-test", mocked: true };

		const c = buildContainer()
			.override("db", mockDb as never)
			.override("config", mockConfig);

		expect(c.get("config")).toEqual(mockConfig);
		expect(c.get("doubts")).toBeInstanceOf(DoubtService);
	});
});
