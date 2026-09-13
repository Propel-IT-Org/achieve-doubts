import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { doubts, solutions, user } from "../src/db/schema";
import { auth } from "../src/lib/auth";
import {
	claimDoubtAtomic,
	createDoubt,
	getDoubtById,
	listDoubtsFeed,
} from "../src/modules/doubts/doubts.service";
import { submitSolutionAtomic } from "../src/modules/solutions/solutions.service";

describe("Doubts Platform Database Integration", () => {
	it("executes full lifecycle: registration -> doubt -> claim -> conflict -> solve", async () => {
		await db.delete(solutions);
		await db.delete(doubts);
		await db.delete(user);

		// 1. Sign up student and solver
		const studentRes = await auth.api.signUpEmail({
			body: {
				name: "Student One",
				email: "student1@example.com",
				password: "Password123!",
			},
		});
		const studentId = studentRes.user.id;

		const solverRes = await auth.api.signUpEmail({
			body: {
				name: "Solver One",
				email: "solver1@example.com",
				password: "Password123!",
			},
		});
		const solverId = solverRes.user.id;
		await db.update(user).set({ role: "solver" }).where(eq(user.id, solverId));

		// 2. Student creates doubt
		const doubt = await createDoubt(studentId, {
			title: "Calculus integration by parts",
			description: "How do I choose u and dv in integral of x*sin(x) dx?",
			subject: "Mathematics",
		});
		expect(doubt.status).toBe("UNLOCKED");

		// 3. Feed query
		const feed = await listDoubtsFeed({ limit: 5 });
		expect(feed.items.length).toBe(1);
		expect(feed.items[0].id).toBe(doubt.id);

		// 4. Atomic claim
		const claimed = await claimDoubtAtomic(doubt.id, solverId);
		expect(claimed).not.toBeNull();
		expect(claimed?.status).toBe("LOCKED");
		expect(claimed?.solverId).toBe(solverId);

		// 5. Conflict race condition test
		const conflict = await claimDoubtAtomic(doubt.id, studentId);
		expect(conflict).toBeNull();

		// 6. Submit solution
		const solved = await submitSolutionAtomic(solverId, {
			doubtId: doubt.id,
			content: "Use LIATE rule: choose u = x, dv = sin(x) dx. Then du = dx, v = -cos(x).",
		});
		expect(solved).not.toBeNull();
		expect(solved?.doubt.status).toBe("RESOLVED");

		// 7. Verification of relations
		const detail = await getDoubtById(doubt.id);
		expect(detail?.student.id).toBe(studentId);
		expect(detail?.solver?.id).toBe(solverId);
		expect(detail?.solutions.length).toBe(1);
	});
});