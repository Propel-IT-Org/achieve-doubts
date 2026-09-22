import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, unique, varchar } from "drizzle-orm/pg-core";

// Level -> subject -> book -> chapter, seeded from the syllabus documents
// (db/seed/taxonomy.ts): a level is a class ("Class 11-12"), a subject a
// paper ("Physics 1st paper"), a book an author's book for that paper, a
// chapter one of that book's chapters.
//
// A student reaches the level their batch is on (batches.level_id) and no
// other, so a class-8 student is never offered the HSC syllabus.

export const levels = pgTable("levels", {
	id: varchar("id", { length: 32 }).primaryKey(),
	nameEn: text("name_en").notNull(),
	nameBn: text("name_bn").notNull(),
	sort: integer("sort").notNull().default(0),
});

export const subjects = pgTable("subjects", {
	id: varchar("id", { length: 32 }).primaryKey(),
	// Nullable until the existing subjects are put on a level; then NOT NULL.
	levelId: varchar("level_id", { length: 32 }).references(() => levels.id, {
		onDelete: "cascade",
	}),
	nameEn: text("name_en").notNull(),
	nameBn: text("name_bn").notNull(),
	sort: integer("sort").notNull().default(0),
});

export const books = pgTable("books", {
	id: varchar("id", { length: 32 }).primaryKey(),
	subjectId: varchar("subject_id", { length: 32 })
		.notNull()
		.references(() => subjects.id, { onDelete: "cascade" }),
	nameEn: text("name_en").notNull(),
	nameBn: text("name_bn").notNull(),
	sort: integer("sort").notNull().default(0),
});

export const chapters = pgTable(
	"chapters",
	{
		id: serial("id").primaryKey(),
		bookId: varchar("book_id", { length: 32 })
			.notNull()
			.references(() => books.id, { onDelete: "cascade" }),
		number: integer("number").notNull(),
		nameEn: text("name_en").notNull(),
		nameBn: text("name_bn").notNull(),
	},
	(table) => [unique("uq_chapters_book_number").on(table.bookId, table.number)],
);

export const levelsRelations = relations(levels, ({ many }) => ({
	subjects: many(subjects),
}));

export const subjectsRelations = relations(subjects, ({ one, many }) => ({
	level: one(levels, { fields: [subjects.levelId], references: [levels.id] }),
	books: many(books),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
	subject: one(subjects, { fields: [books.subjectId], references: [subjects.id] }),
	chapters: many(chapters),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
	book: one(books, { fields: [chapters.bookId], references: [books.id] }),
}));
