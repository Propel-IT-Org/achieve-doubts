import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { doubts, solutions } from "../../db/schema";
import type { CreateSolutionInput } from "./solutions.schema";

export async function submitSolutionAtomic(
	solverId: string,
	input: CreateSolutionInput,
) {
	return db.transaction(async (tx) => {
		// 1. Verify doubt is currently locked by this solver
		const [doubt] = await tx
			.select()
			.from(doubts)
			.where(
				and(
					eq(doubts.id, input.doubtId),
					eq(doubts.solverId, solverId),
					eq(doubts.status, "LOCKED"),
				),
			);

		if (!doubt) {
			return null;
		}

		// 2. Insert solution
		const [solution] = await tx
			.insert(solutions)
			.values({
				doubtId: input.doubtId,
				solverId,
				content: input.content,
				attachmentUrl: input.attachmentUrl,
			})
			.returning();

		// 3. Mark doubt as RESOLVED
		const [resolvedDoubt] = await tx
			.update(doubts)
			.set({
				status: "RESOLVED",
				resolvedAt: sql`NOW()`,
				updatedAt: sql`NOW()`,
			})
			.where(eq(doubts.id, input.doubtId))
			.returning();

		return { solution, doubt: resolvedDoubt };
	});
}

export async function getSolutionsByDoubtId(doubtId: number) {
	return db.query.solutions.findMany({
		where: eq(solutions.doubtId, doubtId),
		with: {
			solver: {
				columns: { id: true, name: true, image: true, role: true },
			},
		},
		orderBy: [desc(solutions.createdAt)],
	});
}
