import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import type { DB } from "../../db";
import { doubts } from "../../db/schema";
import type { CreateDoubtInput, ListDoubtsQuery } from "./doubts.schema";

const LOCK_TIMEOUT_MINUTES = 15;

export type CursorPayload = { createdAt: string; id: number };

export class DoubtService {
	constructor(private db: DB) {}

	async claimDoubtAtomic(doubtId: number, solverId: string) {
		const expirationThreshold = new Date(
			Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000,
		);

		const [claimed] = await this.db
			.update(doubts)
			.set({
				status: "LOCKED",
				solverId,
				lockedAt: sql`NOW()`,
				updatedAt: sql`NOW()`,
			})
			.where(
				and(
					eq(doubts.id, doubtId),
					or(
						eq(doubts.status, "UNLOCKED"),
						and(
							eq(doubts.status, "LOCKED"),
							lt(doubts.lockedAt, expirationThreshold),
						),
					),
				),
			)
			.returning();

		return claimed || null;
	}

	async releaseDoubtAtomic(doubtId: number, solverId: string) {
		const [released] = await this.db
			.update(doubts)
			.set({
				status: "UNLOCKED",
				solverId: null,
				lockedAt: null,
				updatedAt: sql`NOW()`,
			})
			.where(
				and(
					eq(doubts.id, doubtId),
					eq(doubts.solverId, solverId),
					eq(doubts.status, "LOCKED"),
				),
			)
			.returning();

		return released || null;
	}

	async createDoubt(studentId: string, input: CreateDoubtInput) {
		const [created] = await this.db
			.insert(doubts)
			.values({
				studentId,
				title: input.title,
				description: input.description,
				subject: input.subject,
				imageUrl: input.imageUrl,
				status: "UNLOCKED",
			})
			.returning();

		return created;
	}

	async getDoubtById(id: number) {
		return this.db.query.doubts.findFirst({
			where: eq(doubts.id, id),
			with: {
				student: {
					columns: { id: true, name: true, image: true, role: true },
				},
				solver: {
					columns: { id: true, name: true, image: true, role: true },
				},
				solutions: true,
			},
		});
	}

	async listDoubtsFeed(query: ListDoubtsQuery) {
		const limit = query.limit ?? 10;
		let decodedCursor: CursorPayload | null = null;

		if (query.cursor) {
			try {
				decodedCursor = JSON.parse(
					Buffer.from(query.cursor, "base64").toString("utf-8"),
				);
			} catch {
				decodedCursor = null;
			}
		}

		const statusCondition = query.status
			? eq(doubts.status, query.status)
			: eq(doubts.status, "UNLOCKED");

		const subjectCondition = query.subject
			? eq(doubts.subject, query.subject)
			: undefined;

		const cursorCondition = decodedCursor
			? or(
					lt(doubts.createdAt, new Date(decodedCursor.createdAt)),
					and(
						eq(doubts.createdAt, new Date(decodedCursor.createdAt)),
						lt(doubts.id, decodedCursor.id),
					),
				)
			: undefined;

		const conditions = [statusCondition];
		if (subjectCondition) conditions.push(subjectCondition);
		if (cursorCondition) conditions.push(cursorCondition);

		const items = await this.db
			.select()
			.from(doubts)
			.where(and(...conditions))
			.orderBy(desc(doubts.createdAt), desc(doubts.id))
			.limit(limit + 1);

		const hasNextPage = items.length > limit;
		const records = hasNextPage ? items.slice(0, limit) : items;

		const nextCursor = hasNextPage
			? Buffer.from(
					JSON.stringify({
						createdAt: records[records.length - 1].createdAt.toISOString(),
						id: records[records.length - 1].id,
					}),
				).toString("base64")
			: null;

		return { items: records, nextCursor };
	}
}
