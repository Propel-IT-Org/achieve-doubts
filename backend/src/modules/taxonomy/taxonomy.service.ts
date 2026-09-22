import { and, asc, count, eq, max, ne } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { DB } from "../../db";
import {
	auditLog,
	batches,
	books,
	chapters,
	levels,
	questions,
	studentProfiles,
	subjects,
} from "../../db/schema";
import { cached, invalidate } from "../../lib/cache";

/** Staff edits drop the cache, so this only has to cover the read traffic. */
const TTL_SECONDS = 300;

const LEVELS_CACHE_KEY = "cache:levels";
const taxonomyCacheKey = (levelId: string | null) =>
	`cache:taxonomy:${levelId ?? "all"}`;

/** A question already filed under a row is why that row can't be deleted. */
const inUse = (what: string, used: number) =>
	`${used} ${used === 1 ? "question is" : "questions are"} filed under this ${what}`;

/** One audit row, so each write states who changed what in one line. */
const entry = (
	actorId: string,
	action: string,
	entityType: string,
	entityId: string,
	meta?: Record<string, unknown>,
) => ({
	actorId,
	action: `taxonomy.${action}`,
	entityType,
	entityId,
	meta: meta ?? null,
});

/** Ids are internal, so they are made from the English name, not typed in. */
function slugify(name: string) {
	const slug = name
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 24);
	return slug || "item";
}

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

	// ---------- editing ----------
	//
	// Staff maintain the tree from the admin panel. Each write and its audit
	// entry commit together, and the cached trees are dropped afterwards so
	// the next read shows the edit rather than whatever the TTL still holds.

	async createLevel(
		input: { nameEn: string; nameBn: string; sort: number },
		actorId: string,
	) {
		const id = await this.freeId(levels, slugify(input.nameEn));
		const row = await this.db.transaction(async (tx) => {
			const [created] = await tx
				.insert(levels)
				.values({ id, ...input })
				.returning();
			await tx.insert(auditLog).values(entry(actorId, "level.create", "level", id));
			return created;
		});

		await this.dropCaches();
		return { row };
	}

	async updateLevel(
		id: string,
		input: { nameEn?: string; nameBn?: string; sort?: number },
		actorId: string,
	) {
		const row = await this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(levels)
				.set(input)
				.where(eq(levels.id, id))
				.returning();
			if (!updated) return undefined;
			await tx
				.insert(auditLog)
				.values(entry(actorId, "level.update", "level", id, input));
			return updated;
		});

		if (!row) return { error: "Class not found" as const };
		await this.dropCaches();
		return { row };
	}

	/**
	 * Only an empty class nobody is enrolled in. Its subjects would cascade
	 * away with it, and its batches would point at nothing — batches.level_id
	 * has no foreign key to stop that, so this does.
	 */
	async deleteLevel(id: string, actorId: string) {
		const subjectCount = await this.countRows(subjects, eq(subjects.levelId, id));
		if (subjectCount > 0) {
			return { error: "Remove this class's subjects first" as const };
		}

		const batchCount = await this.countRows(batches, eq(batches.levelId, id));
		if (batchCount > 0) {
			return { error: "Batches are still on this class" as const };
		}

		const row = await this.db.transaction(async (tx) => {
			const [deleted] = await tx.delete(levels).where(eq(levels.id, id)).returning();
			if (!deleted) return undefined;
			await tx.insert(auditLog).values(entry(actorId, "level.delete", "level", id));
			return deleted;
		});

		if (!row) return { error: "Class not found" as const };
		await this.dropCaches();
		return { row };
	}

	async createSubject(
		input: { levelId: string; nameEn: string; nameBn: string; sort: number },
		actorId: string,
	) {
		if (!(await this.exists(levels, input.levelId))) {
			return { error: "Class not found" as const };
		}

		const id = await this.freeId(subjects, slugify(input.nameEn));
		const row = await this.db.transaction(async (tx) => {
			const [created] = await tx
				.insert(subjects)
				.values({ id, ...input })
				.returning();
			await tx
				.insert(auditLog)
				.values(entry(actorId, "subject.create", "subject", id));
			return created;
		});

		await this.dropCaches();
		return { row };
	}

	/**
	 * Moving a subject to another class takes its books, chapters and every
	 * question already filed under it along — which is right: the question
	 * was always about that subject.
	 */
	async updateSubject(
		id: string,
		input: { levelId?: string; nameEn?: string; nameBn?: string; sort?: number },
		actorId: string,
	) {
		if (input.levelId && !(await this.exists(levels, input.levelId))) {
			return { error: "Class not found" as const };
		}

		const row = await this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(subjects)
				.set(input)
				.where(eq(subjects.id, id))
				.returning();
			if (!updated) return undefined;
			await tx
				.insert(auditLog)
				.values(entry(actorId, "subject.update", "subject", id, input));
			return updated;
		});

		if (!row) return { error: "Subject not found" as const };
		await this.dropCaches();
		return { row };
	}

	async deleteSubject(id: string, actorId: string) {
		const used = await this.countRows(questions, eq(questions.subjectId, id));
		if (used > 0) return { error: inUse("subject", used) };

		const row = await this.db.transaction(async (tx) => {
			const [deleted] = await tx.delete(subjects).where(eq(subjects.id, id)).returning();
			if (!deleted) return undefined;
			await tx
				.insert(auditLog)
				.values(entry(actorId, "subject.delete", "subject", id));
			return deleted;
		});

		if (!row) return { error: "Subject not found" as const };
		await this.dropCaches();
		return { row };
	}

	async createBook(
		input: { subjectId: string; nameEn: string; nameBn: string; sort: number },
		actorId: string,
	) {
		if (!(await this.exists(subjects, input.subjectId))) {
			return { error: "Subject not found" as const };
		}

		// The seed's ids read "phy1-tapan"; new ones keep that shape.
		const id = await this.freeId(books, `${input.subjectId}-${slugify(input.nameEn)}`);
		const row = await this.db.transaction(async (tx) => {
			const [created] = await tx
				.insert(books)
				.values({ id, ...input })
				.returning();
			await tx.insert(auditLog).values(entry(actorId, "book.create", "book", id));
			return created;
		});

		await this.dropCaches();
		return { row };
	}

	async updateBook(
		id: string,
		input: { nameEn?: string; nameBn?: string; sort?: number },
		actorId: string,
	) {
		const row = await this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(books)
				.set(input)
				.where(eq(books.id, id))
				.returning();
			if (!updated) return undefined;
			await tx.insert(auditLog).values(entry(actorId, "book.update", "book", id, input));
			return updated;
		});

		if (!row) return { error: "Book not found" as const };
		await this.dropCaches();
		return { row };
	}

	async deleteBook(id: string, actorId: string) {
		const used = await this.countRows(questions, eq(questions.bookId, id));
		if (used > 0) return { error: inUse("book", used) };

		const row = await this.db.transaction(async (tx) => {
			const [deleted] = await tx.delete(books).where(eq(books.id, id)).returning();
			if (!deleted) return undefined;
			await tx.insert(auditLog).values(entry(actorId, "book.delete", "book", id));
			return deleted;
		});

		if (!row) return { error: "Book not found" as const };
		await this.dropCaches();
		return { row };
	}

	/** `number` is the chapter's place in the book; left out, it goes last. */
	async createChapter(
		input: { bookId: string; number?: number; nameEn: string; nameBn: string },
		actorId: string,
	) {
		if (!(await this.exists(books, input.bookId))) {
			return { error: "Book not found" as const };
		}

		const number = input.number ?? (await this.nextChapterNumber(input.bookId));
		if (await this.chapterNumberTaken(input.bookId, number)) {
			return { error: `Chapter ${number} already exists in this book` };
		}

		const row = await this.db.transaction(async (tx) => {
			const [created] = await tx
				.insert(chapters)
				.values({
					bookId: input.bookId,
					number,
					nameEn: input.nameEn,
					nameBn: input.nameBn,
				})
				.returning();
			await tx
				.insert(auditLog)
				.values(entry(actorId, "chapter.create", "chapter", String(created?.id)));
			return created;
		});

		await this.dropCaches();
		return { row };
	}

	async updateChapter(
		id: number,
		input: { number?: number; nameEn?: string; nameBn?: string },
		actorId: string,
	) {
		const [current] = await this.db
			.select({ bookId: chapters.bookId })
			.from(chapters)
			.where(eq(chapters.id, id));
		if (!current) return { error: "Chapter not found" };

		if (
			input.number !== undefined &&
			(await this.chapterNumberTaken(current.bookId, input.number, id))
		) {
			return { error: `Chapter ${input.number} already exists in this book` };
		}

		const row = await this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(chapters)
				.set(input)
				.where(eq(chapters.id, id))
				.returning();
			if (!updated) return undefined;
			await tx
				.insert(auditLog)
				.values(entry(actorId, "chapter.update", "chapter", String(id), input));
			return updated;
		});

		if (!row) return { error: "Chapter not found" };
		await this.dropCaches();
		return { row };
	}

	async deleteChapter(id: number, actorId: string) {
		const used = await this.countRows(questions, eq(questions.chapterId, id));
		if (used > 0) return { error: inUse("chapter", used) };

		const row = await this.db.transaction(async (tx) => {
			const [deleted] = await tx.delete(chapters).where(eq(chapters.id, id)).returning();
			if (!deleted) return undefined;
			await tx
				.insert(auditLog)
				.values(entry(actorId, "chapter.delete", "chapter", String(id)));
			return deleted;
		});

		if (!row) return { error: "Chapter not found" };
		await this.dropCaches();
		return { row };
	}

	// ---------- shared ----------

	private async countRows(
		table: typeof subjects | typeof batches | typeof questions,
		where: SQL,
	) {
		const [row] = await this.db.select({ value: count() }).from(table).where(where);
		return row?.value ?? 0;
	}

	private async exists(
		table: typeof levels | typeof subjects | typeof books,
		id: string,
	) {
		const [row] = await this.db
			.select({ id: table.id })
			.from(table)
			.where(eq(table.id, id));
		return Boolean(row);
	}

	private async nextChapterNumber(bookId: string) {
		const [row] = await this.db
			.select({ value: max(chapters.number) })
			.from(chapters)
			.where(eq(chapters.bookId, bookId));
		return (row?.value ?? 0) + 1;
	}

	private async chapterNumberTaken(
		bookId: string,
		number: number,
		exceptId?: number,
	) {
		const [row] = await this.db
			.select({ id: chapters.id })
			.from(chapters)
			.where(
				and(
					eq(chapters.bookId, bookId),
					eq(chapters.number, number),
					exceptId === undefined ? undefined : ne(chapters.id, exceptId),
				),
			);
		return Boolean(row);
	}

	/** `physics`, then `physics-2`: ids are generated, so collisions are ours to settle. */
	private async freeId(
		table: typeof levels | typeof subjects | typeof books,
		base: string,
	) {
		for (let n = 1; ; n++) {
			const suffix = n === 1 ? "" : `-${n}`;
			const id = `${base.slice(0, 32 - suffix.length)}${suffix}`;
			if (!(await this.exists(table, id))) return id;
		}
	}

	/**
	 * Every cached tree, not only the level that changed: a subject can move
	 * between classes, and the "all" tree holds the lot anyway.
	 */
	private async dropCaches() {
		const ids = await this.db.select({ id: levels.id }).from(levels);
		await invalidate(
			LEVELS_CACHE_KEY,
			taxonomyCacheKey(null),
			...ids.map((level) => taxonomyCacheKey(level.id)),
		);
	}
}
