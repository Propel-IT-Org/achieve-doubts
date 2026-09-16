import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { questionStatusEnum, threadAuthorEnum } from "./enums";
import { books, chapters, subjects } from "./taxonomy";

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    askerId: text("asker_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: varchar("subject_id", { length: 32 })
      .notNull()
      .references(() => subjects.id),
    bookId: varchar("book_id", { length: 32 })
      .notNull()
      .references(() => books.id),
    chapterId: integer("chapter_id")
      .notNull()
      .references(() => chapters.id),
    text: text("text").notNull(),
    photoUrl: text("photo_url"),
    // Reserved for a future OCR/LaTeX transcription + dedupe pipeline
    // (see legacy Appwrite schema notes) — not populated by any code path yet.
    transcription: text("transcription"),
    status: questionStatusEnum("status").notNull().default("waiting"),
    solverId: text("solver_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lockedAt: timestamp("locked_at"),
    lockExpiresAt: timestamp("lock_expires_at"),
    matchedAfterSec: integer("matched_after_sec"),
    askedAt: timestamp("asked_at").defaultNow().notNull(),
    answeredAt: timestamp("answered_at"),
    ratedAt: timestamp("rated_at"),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("idx_questions_status_asked").on(table.status, table.askedAt),
    index("idx_questions_feed_cursor").on(
      table.status,
      table.askedAt.desc(),
      table.id.desc(),
    ),
    index("idx_questions_taxonomy").on(
      table.subjectId,
      table.bookId,
      table.chapterId,
    ),
    index("idx_questions_asker").on(table.askerId),
    index("idx_questions_solver_status").on(table.solverId, table.status),
    // Search is `ilike '%term%'`, which no btree can serve — without this it
    // is a sequential scan of the whole table on every query. Needs the
    // pg_trgm extension, created in the migration because an extension can't
    // be expressed in the drizzle schema.
    index("idx_questions_text_trgm").using(
      "gin",
      table.text.op("gin_trgm_ops"),
    ),
    // Payout ranges filter on answered_at and the analytics trend groups by
    // date_trunc('day', answered_at). Partial because most rows are NULL
    // (never answered), which keeps the index small.
    index("idx_questions_answered_at")
      .on(table.answeredAt)
      .where(sql`${table.answeredAt} is not null`),
  ],
);

export const solutions = pgTable(
  "solutions",
  {
    id: serial("id").primaryKey(),
    // Unique — enforces exactly one solution per question at the DB level,
    // and the unique index is what serves lookups by question_id.
    questionId: integer("question_id")
      .notNull()
      .unique()
      .references(() => questions.id, { onDelete: "cascade" }),
    solverId: text("solver_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text"),
    imageUrl: text("image_url"),
    audioUrl: text("audio_url"),
    audioSeconds: integer("audio_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    // computeSolverStats and the analytics/payout joins all filter by solver.
    index("idx_solutions_solver").on(table.solverId),
  ],
);

// Private asker <-> assigned-solver follow-up thread. Readable by any
// logged-in user once a solution exists; postable only by the two parties.
export const threadMessages = pgTable(
  "thread_messages",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    authorSide: threadAuthorEnum("author_side").notNull(),
    text: text("text"),
    imageUrl: text("image_url"),
    audioUrl: text("audio_url"),
    audioSeconds: integer("audio_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("idx_thread_question").on(table.questionId, table.createdAt),
  ],
);

// Public comment thread — any student may post; solvers explicitly cannot.
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    text: text("text"),
    imageUrl: text("image_url"),
    audioUrl: text("audio_url"),
    audioSeconds: integer("audio_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedBy: text("deleted_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("idx_comments_question").on(table.questionId, table.createdAt),
  ],
);

export const questionsRelations = relations(questions, ({ one, many }) => ({
  asker: one(user, { fields: [questions.askerId], references: [user.id] }),
  solver: one(user, { fields: [questions.solverId], references: [user.id] }),
  subject: one(subjects, {
    fields: [questions.subjectId],
    references: [subjects.id],
  }),
  book: one(books, { fields: [questions.bookId], references: [books.id] }),
  chapter: one(chapters, {
    fields: [questions.chapterId],
    references: [chapters.id],
  }),
  solution: one(solutions, {
    fields: [questions.id],
    references: [solutions.questionId],
  }),
  thread: many(threadMessages),
  comments: many(comments),
}));

export const solutionsRelations = relations(solutions, ({ one }) => ({
  question: one(questions, {
    fields: [solutions.questionId],
    references: [questions.id],
  }),
  solver: one(user, { fields: [solutions.solverId], references: [user.id] }),
}));

export const threadMessagesRelations = relations(threadMessages, ({ one }) => ({
  question: one(questions, {
    fields: [threadMessages.questionId],
    references: [questions.id],
  }),
  author: one(user, {
    fields: [threadMessages.authorId],
    references: [user.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  question: one(questions, {
    fields: [comments.questionId],
    references: [questions.id],
  }),
  author: one(user, { fields: [comments.authorId], references: [user.id] }),
}));
