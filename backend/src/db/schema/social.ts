import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { notifTypeEnum, reportReasonEnum, reportStatusEnum } from "./enums";
import { questions } from "./questions";

export const reports = pgTable(
  "reports",
  {
    id: serial("id").primaryKey(),
    questionId: integer("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reason: reportReasonEnum("reason").notNull(),
    text: text("text").notNull(),
    status: reportStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("idx_reports_status_created").on(table.status, table.createdAt),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: notifTypeEnum("type").notNull(),
    questionId: integer("question_id").references(() => questions.id, {
      onDelete: "cascade",
    }),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    readAt: timestamp("read_at"),
  },
  (table) => [
    index("idx_notifications_user_read").on(table.userId, table.readAt),
  ],
);

export const reportsRelations = relations(reports, ({ one }) => ({
  question: one(questions, {
    fields: [reports.questionId],
    references: [questions.id],
  }),
  reporter: one(user, { fields: [reports.reporterId], references: [user.id] }),
  resolver: one(user, { fields: [reports.resolvedBy], references: [user.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(user, { fields: [notifications.userId], references: [user.id] }),
  question: one(questions, {
    fields: [notifications.questionId],
    references: [questions.id],
  }),
  actor: one(user, { fields: [notifications.actorId], references: [user.id] }),
}));
