import { relations } from "drizzle-orm";
import { integer, pgTable, serial, text, unique, varchar } from "drizzle-orm/pg-core";

// Subject -> book -> chapter, seeded from the HSC syllabus document
// (db/seed/taxonomy.ts): a subject is a paper ("Physics 1st paper"), a book
// an author's book for that paper, a chapter one of that book's chapters.

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
}));

export const booksRelations = relations(books, ({ one, many }) => ({
	subject: one(subjects, { fields: [books.subjectId], references: [subjects.id] }),
	chapters: many(chapters),
}));

export const chaptersRelations = relations(chapters, ({ one }) => ({
	book: one(books, { fields: [chapters.bookId], references: [books.id] }),
}));
