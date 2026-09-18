import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, unique, varchar } from "drizzle-orm/pg-core";

// HSC taxonomy, seeded from the syllabus document (db/seed/taxonomy.ts):
//
//   subject -> paper -> chapter     where a question sits in the syllabus
//   subject (-> paper) -> textbook  which printed book it came from
//
// The paper table is called `books`, and its ids are `bookId` throughout —
// the name predates the textbook level, and renaming it would ripple
// through every question, filter and URL. A "book" in code is a PAPER
// ("Physics 1st paper"); a "textbook" is an author's book.

export const subjects = pgTable("subjects", {
	id: varchar("id", { length: 32 }).primaryKey(),
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

/**
 * A published textbook for a subject. Most cover both papers of their
 * subject (`bookId` null); Biology's are one per paper (Botany, Zoology),
 * so theirs name the paper.
 */
export const textbooks = pgTable("textbooks", {
	id: varchar("id", { length: 48 }).primaryKey(),
	subjectId: varchar("subject_id", { length: 32 })
		.notNull()
		.references(() => subjects.id, { onDelete: "cascade" }),
	bookId: varchar("book_id", { length: 32 }).references(() => books.id, {
		onDelete: "cascade",
	}),
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

export const subjectsRelations = relations(subjects, ({ many }) => ({
	books: many(books),
	textbooks: many(textbooks),
}));

export const textbooksRelations = relations(textbooks, ({ one }) => ({
	subject: one(subjects, { fields: [textbooks.subjectId], references: [subjects.id] }),
	book: one(books, { fields: [textbooks.bookId], references: [books.id] }),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
	subject: one(subjects, { fields: [books.subjectId], references: [subjects.id] }),
	chapters: many(chapters),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
	book: one(books, { fields: [chapters.bookId], references: [books.id] }),
}));
