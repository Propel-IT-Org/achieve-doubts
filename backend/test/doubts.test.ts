import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { doubts, solutions, user } from "../src/db/schema";
import { container } from "../src/lib/di";

describe("Doubts Platform with InferDI Container", () => {
	it("executes full lifecycle using dependency-injected services", async () => {
		const db = container.get("db");
		const auth = container.get("auth");
		const doubtService = container.get("doubts");
		const solutionService = container.get("solutions");
		const uploadService = container.get("upload");
		const attestationService = container.get("attestation");

		await db.delete(solutions);
		await db.delete(doubts);
		await db.delete(user);

		// 1. Sign up student and solver via DI Auth
		const studentRes = await auth.api.signUpEmail({
			body: {
				name: "Student DI",
				email: "student_di@example.com",
				password: "Password123!",
			},
		});
		const studentId = studentRes.user.id;

		const solverRes = await auth.api.signUpEmail({
			body: {
				name: "Solver DI",
				email: "solver_di@example.com",
				password: "Password123!",
			},
		});
		const solverId = solverRes.user.id;
		await db.update(user).set({ role: "solver" }).where(eq(user.id, solverId));

		// 2. Test upload presign service from DI
		const presigned = await uploadService.createPresignedUpload(
			"diagram.png",
			"image/png",
			studentId,
		);
		expect(presigned.uploadUrl).toBeDefined();
		expect(presigned.key).toContain(studentId);

		// 3. Test attestation service from DI
		const token = await attestationService.generateToken();
		const isValid = await attestationService.verifyToken(token);
		expect(isValid).toBe(true);

		// 4. Student creates doubt via DoubtService
		const doubt = await doubtService.createDoubt(studentId, {
			title: "Calculus integration by parts with DI",
			description: "How do I choose u and dv in integral of x*sin(x) dx?",
			subject: "Mathematics",
			imageUrl: presigned.publicUrl,
		});
		expect(doubt.status).toBe("UNLOCKED");

		// 5. Feed query via DoubtService
		const feed = await doubtService.listDoubtsFeed({ limit: 5 });
		expect(feed.items.length).toBe(1);
		expect(feed.items[0].id).toBe(doubt.id);

		// 6. Atomic claim via DoubtService
		const claimed = await doubtService.claimDoubtAtomic(doubt.id, solverId);
		expect(claimed).not.toBeNull();
		expect(claimed?.status).toBe("LOCKED");
		expect(claimed?.solverId).toBe(solverId);

		// 7. Conflict rejection
		const conflict = await doubtService.claimDoubtAtomic(doubt.id, studentId);
		expect(conflict).toBeNull();

		// 8. Submit solution via SolutionService
		const solved = await solutionService.submitSolutionAtomic(solverId, {
			doubtId: doubt.id,
			content: "Use LIATE rule: choose u = x, dv = sin(x) dx.",
		});
		expect(solved).not.toBeNull();
		expect(solved?.doubt.status).toBe("RESOLVED");

		// 9. Verification of solutions query via SolutionService
		const solutionItems = await solutionService.getSolutionsByDoubtId(doubt.id);
		expect(solutionItems.length).toBe(1);
		expect(solutionItems[0].solverId).toBe(solverId);

		// 10. Verification of relational query via DoubtService
		const detail = await doubtService.getDoubtById(doubt.id);
		expect(detail?.student.id).toBe(studentId);
		expect(detail?.solver?.id).toBe(solverId);
		expect(detail?.solutions.length).toBe(1);
	});
});