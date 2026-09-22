import { asc, eq } from "drizzle-orm";
import type { DB } from "../../db";
import { batches, levels, studentProfiles } from "../../db/schema";
import { cached } from "../../lib/cache";

/** The tree only changes when the seed runs, so a few minutes' staleness is harmless. */
const TTL_SECONDS = 300;

export class TaxonomyService {
	constructor(private readonly db: DB) {}

	/**
	 * The class a user studies, which is their batch's level — null for
	 * solvers and staff, and for a student whose batch has no level set.
	 * Null means "every level": the syllabus is not a permission, it is a
	 * filter, and a student with no level is better off seeing all of it
	 * than none of it.
	 */
	async levelForUser(userId: string): Promise<string | null> {
		const [row] = await this.db
			.select({ levelId: batches.levelId })
			.from(studentProfiles)
			.innerJoin(batches, eq(batches.id, studentProfiles.batchId))
			.where(eq(studentProfiles.userId, userId));
		return row?.levelId ?? null;
	}

	/** Every level, in class order. Staff pick from these when editing a batch. */
	listLevels() {
		return cached("cache:levels", TTL_SECONDS, () =>
			this.db.select().from(levels).orderBy(asc(levels.sort)),
		);
	}

	/**
	 * subject -> book -> chapter, for one level or for all of them. Each
	 * subject carries its level, because a solver answers across classes and
	 * has to see which one a question came from.
	 */
	tree(levelId: string | null) {
		return cached(
			`cache:taxonomy:${levelId ?? "all"}`,
			TTL_SECONDS,
			async () => {
				const rows = await this.db.query.subjects.findMany({
					where: levelId ? (s, { eq }) => eq(s.levelId, levelId) : undefined,
					with: {
						level: true,
						books: {
							orderBy: (b, { asc }) => [asc(b.sort)],
							with: {
								chapters: {
									orderBy: (ch, { asc }) => [asc(ch.number)],
								},
							},
						},
					},
				});

				// Ordering by the level's sort column needs a join the relational
				// query can't express, and the list is ~10 rows.
				return rows.sort(
					(a, b) => a.level.sort - b.level.sort || a.sort - b.sort,
				);
			},
		);
	}
}
