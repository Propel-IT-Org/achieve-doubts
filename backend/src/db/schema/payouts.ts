import { relations } from "drizzle-orm";
import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { payoutStatusEnum } from "./enums";

// A manual-payout snapshot for a date range: figures are computed in SQL at
// generation time and frozen here — the immutable record an admin exported
// and (manually, outside this system) paid a solver against.
export const payoutPeriods = pgTable("payout_periods", {
  id: serial("id").primaryKey(),
  fromDate: timestamp("from_date").notNull(),
  toDate: timestamp("to_date").notNull(),
  status: payoutStatusEnum("status").notNull().default("draft"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  paidAt: timestamp("paid_at"),
  note: text("note"),
});

export const payoutLines = pgTable("payout_lines", {
  id: serial("id").primaryKey(),
  periodId: integer("period_id")
    .notNull()
    .references(() => payoutPeriods.id, { onDelete: "cascade" }),
  solverId: text("solver_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  answered: integer("answered").notNull().default(0),
  satisfied: integer("satisfied").notNull().default(0),
  unsatisfied: integer("unsatisfied").notNull().default(0),
  unrated: integer("unrated").notNull().default(0),
  avgRespMin: numeric("avg_resp_min"),
  rate: numeric("rate"),
  amount: numeric("amount"),
});

export const payoutPeriodsRelations = relations(payoutPeriods, ({ many }) => ({
  lines: many(payoutLines),
}));

export const payoutLinesRelations = relations(payoutLines, ({ one }) => ({
  period: one(payoutPeriods, {
    fields: [payoutLines.periodId],
    references: [payoutPeriods.id],
  }),
  solver: one(user, { fields: [payoutLines.solverId], references: [user.id] }),
}));
