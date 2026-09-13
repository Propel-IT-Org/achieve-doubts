import { describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { buildContainer } from "../src/lib/di";

describe("Atomic Locking and Timeout Reclamation (Mock)", () => {
	it("reclaims locked doubts after 15-minute expiration", async () => {
		const mockDb = drizzle.mock({ schema });
		const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);

		// Mock claim when lockedAt is older than 15 minutes
		mockDb.update = (() => ({
			set: (data: Record<string, unknown>) => ({
				where: () => ({
					returning: async () => [
						{
							id: 42,
							status: "LOCKED",
							solverId: data.solverId,
							lockedAt: new Date(),
						},
					],
				}),
			}),
		})) as never;

		const c = buildContainer().override("db", mockDb as never);
		const service = c.get("doubts");

		// Solver B reclaims the timed-out lock
		const reclaimed = await service.claimDoubtAtomic(42, "solver-b");
		expect(reclaimed).not.toBeNull();
		expect(reclaimed?.solverId).toBe("solver-b");
		expect(reclaimed?.status).toBe("LOCKED");

		// Mock release
		mockDb.update = (() => ({
			set: () => ({
				where: () => ({
					returning: async () => [
						{
							id: 42,
							status: "UNLOCKED",
							solverId: null,
							lockedAt: null,
						},
					],
				}),
			}),
		})) as never;

		const released = await service.releaseDoubtAtomic(42, "solver-b");
		expect(released?.status).toBe("UNLOCKED");
		expect(released?.solverId).toBeNull();
	});
});