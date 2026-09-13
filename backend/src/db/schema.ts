import { relations } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const doubtStatusEnum = pgEnum("doubt_status", [
	"UNLOCKED",
	"LOCKED",
	"RESOLVED",
	"EXPIRED",
]);

export const doubts = pgTable(
	"doubts",
	{
		id: serial("id").primaryKey(),
		title: varchar("title", { length: 255 }).notNull(),
		description: text("description").notNull(),
		subject: varchar("subject", { length: 64 }).notNull(),
		imageUrl: text("image_url"),
		status: doubtStatusEnum("status").default("UNLOCKED").notNull(),
		studentId: text("student_id")
			.references(() => user.id, { onDelete: "cascade" })
			.notNull(),
		solverId: text("solver_id").references(() => user.id, { onDelete: "set null" }),
		lockedAt: timestamp("locked_at"),
		resolvedAt: timestamp("resolved_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("idx_doubts_status_created").on(table.status, table.createdAt),
		index("idx_doubts_subject").on(table.subject),
		index("idx_doubts_feed_cursor").on(
			table.status,
			table.createdAt.desc(),
			table.id.desc(),
		),
	],
);

export const solutions = pgTable("solutions", {
	id: serial("id").primaryKey(),
	doubtId: integer("doubt_id")
		.references(() => doubts.id, { onDelete: "cascade" })
		.notNull(),
	solverId: text("solver_id")
		.references(() => user.id, { onDelete: "cascade" })
		.notNull(),
	content: text("content").notNull(),
	attachmentUrl: text("attachment_url"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const doubtsRelations = relations(doubts, ({ one, many }) => ({
	student: one(user, { fields: [doubts.studentId], references: [user.id] }),
	solver: one(user, { fields: [doubts.solverId], references: [user.id] }),
	solutions: many(solutions),
}));

export const solutionsRelations = relations(solutions, ({ one }) => ({
	doubt: one(doubts, { fields: [solutions.doubtId], references: [doubts.id] }),
	solver: one(user, { fields: [solutions.solverId], references: [user.id] }),
}));
