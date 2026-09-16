import { describe, expect, it } from "bun:test";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { buildContainer } from "../src/lib/di";

describe("Doubts Platform Lifecycle with InferDI (Mock)", () => {
	it("executes full doubt & solution lifecycle with mocked database", async () => {
		const mockDb = drizzle.mock({ schema });

		const c = buildContainer().override("db", mockDb as never);
		const doubtService = c.get("doubts");
		const solutionService = c.get("solutions");
		const uploadService = c.get("upload");
		const attestationService = c.get("attestation");

		const presigned = await uploadService.createPresignedUpload(
			"diagram.png",
			"image/png",
			"student-123",
		);
		expect(presigned.uploadUrl).toBeDefined();

		const token = await attestationService.generateToken();
		expect(await attestationService.verifyToken(token)).toBe(true);

		mockDb.insert = (() => ({
			values: (vals: Record<string, unknown>) => ({
				returning: async () => [{ id: 1, status: "UNLOCKED", ...vals }],
			}),
		})) as never;

		const doubt = await doubtService.createDoubt("student-123", {
			title: "Calculus integration",
			description: "How to integrate x*sin(x)?",
			subject: "Math",
			imageUrl: presigned.publicUrl,
		});
		expect(doubt.status).toBe("UNLOCKED");

		mockDb.update = (() => ({
			set: (data: Record<string, unknown>) => ({
				where: () => ({
					returning: async () => [
						{
							id: 1,
							status: "LOCKED",
							solverId: data.solverId,
							lockedAt: new Date(),
						},
					],
				}),
			}),
		})) as never;

		const claimed = await doubtService.claimDoubtAtomic(1, "solver-456");
		expect(claimed?.status).toBe("LOCKED");
		expect(claimed?.solverId).toBe("solver-456");

		mockDb.transaction = (async (cb: (tx: unknown) => Promise<unknown>) => {
			const txMock = {
				select: () => ({
					from: () => ({
						where: async () => [
							{ id: 1, status: "LOCKED", solverId: "solver-456" },
						],
					}),
				}),
				update: () => ({
					set: () => ({
						where: () => ({
							returning: async () => [{ id: 1, status: "RESOLVED" }],
						}),
					}),
				}),
				insert: () => ({
					values: (vals: Record<string, unknown>) => ({
						returning: async () => [{ id: 99, ...vals }],
					}),
				}),
			};
			return cb(txMock);
		}) as never;

		const solved = await solutionService.submitSolutionAtomic("solver-456", {
			doubtId: 1,
			content: "Use LIATE rule.",
		});
		expect(solved?.doubt.status).toBe("RESOLVED");
	});
});
