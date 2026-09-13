import { describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { buildContainer } from "../src/lib/di";

describe("DoubtService Unit Tests with Drizzle Mock & InferDI Override", () => {
	it("creates a doubt with UNLOCKED status", async () => {
		const mockDb = drizzle.mock({ schema });
		mockDb.insert = (() => ({
			values: (vals: Record<string, unknown>) => ({
				returning: async () => [
					{
						id: 101,
						studentId: vals.studentId,
						title: vals.title,
						description: vals.description,
						subject: vals.subject,
						imageUrl: vals.imageUrl ?? null,
						status: "UNLOCKED",
						createdAt: new Date(),
						updatedAt: new Date(),
					},
				],
			}),
		})) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("doubts");

		const created = await service.createDoubt("student-xyz", {
			title: "Integration Question",
			description: "How to integrate by parts?",
			subject: "Math",
		});

		expect(created?.id).toBe(101);
		expect(created?.studentId).toBe("student-xyz");
		expect(created?.status).toBe("UNLOCKED");
	});

	it("claims doubt atomically when unlocked", async () => {
		const mockDb = drizzle.mock({ schema });
		mockDb.update = (() => ({
			set: (data: Record<string, unknown>) => ({
				where: () => ({
					returning: async () => [
						{
							id: 101,
							status: data.status,
							solverId: data.solverId,
							lockedAt: new Date(),
						},
					],
				}),
			}),
		})) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("doubts");

		const claimed = await service.claimDoubtAtomic(101, "solver-abc");

		expect(claimed).not.toBeNull();
		expect(claimed?.status).toBe("LOCKED");
		expect(claimed?.solverId).toBe("solver-abc");
	});

	it("returns null on atomic claim conflict", async () => {
		const mockDb = drizzle.mock({ schema });
		mockDb.update = (() => ({
			set: () => ({
				where: () => ({
					returning: async () => [],
				}),
			}),
		})) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("doubts");

		const conflict = await service.claimDoubtAtomic(101, "solver-conflict");

		expect(conflict).toBeNull();
	});

	it("releases a locked doubt back to UNLOCKED", async () => {
		const mockDb = drizzle.mock({ schema });
		mockDb.update = (() => ({
			set: (data: Record<string, unknown>) => ({
				where: () => ({
					returning: async () => [
						{
							id: 101,
							status: data.status,
							solverId: data.solverId,
						},
					],
				}),
			}),
		})) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("doubts");

		const released = await service.releaseDoubtAtomic(101, "solver-abc");

		expect(released).not.toBeNull();
		expect(released?.status).toBe("UNLOCKED");
		expect(released?.solverId).toBeNull();
	});

	it("lists doubts feed with next cursor pagination", async () => {
		const mockDb = drizzle.mock({ schema });
		const mockRecords = [
			{ id: 2, title: "Doubt 2", createdAt: new Date("2026-09-01T12:00:00Z") },
			{ id: 1, title: "Doubt 1", createdAt: new Date("2026-09-01T11:00:00Z") },
			{ id: 0, title: "Doubt 0", createdAt: new Date("2026-09-01T10:00:00Z") },
		];

		mockDb.select = (() => ({
			from: () => ({
				where: () => ({
					orderBy: () => ({
						limit: async () => mockRecords,
					}),
				}),
			}),
		})) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("doubts");

		const feed = await service.listDoubtsFeed({ limit: 2 });

		expect(feed.items.length).toBe(2);
		expect(feed.nextCursor).not.toBeNull();

		const decoded = JSON.parse(
			Buffer.from(feed.nextCursor as string, "base64").toString("utf-8"),
		);
		expect(decoded.id).toBe(1);
	});
});
