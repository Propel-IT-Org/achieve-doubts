import { asc, eq } from "drizzle-orm";
import type { DB } from "../../db";
import { batches, levels, studentProfiles } from "../../db/schema";
import { cached } from "../../lib/cache";

/** Staff edits drop the cache, so this only has to cover the read traffic. */
const TTL_SECONDS = 300;

const LEVELS_CACHE_KEY = "cache:levels";
const taxonomyCacheKey = (levelId: string | null) =>
	`cache:taxonomy:${levelId ?? "all"}`;

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
		return cached(LEVELS_CACHE_KEY, TTL_SECONDS, () =>
			this.db.select().from(levels).orderBy(asc(levels.sort)),
		);
	}

	/**
	 * The whole tree, level -> subject -> book -> chapter, for one level or
	 * for all of them. Nested and ordered here so no client has to group or
	 * filter it: a student gets exactly their class, everyone else gets the
	 * lot, and each is one array to render.
	 */
	tree(levelId: string | null) {
		return cached(taxonomyCacheKey(levelId), TTL_SECONDS, () =>
			this.db.query.levels.findMany({
				where: levelId ? (l, { eq }) => eq(l.id, levelId) : undefined,
				orderBy: (l, { asc }) => [asc(l.sort)],
				with: {
					subjects: {
						orderBy: (s, { asc }) => [asc(s.sort)],
						with: {
							books: {
								orderBy: (b, { asc }) => [asc(b.sort)],
								with: {
									chapters: {
										orderBy: (ch, { asc }) => [asc(ch.number)],
									},
								},
							},
						},
					},
				},
			}),
		);
	}
}
