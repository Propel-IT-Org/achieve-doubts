import { relations } from "drizzle-orm";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Profile data for solver accounts.
 *
 * There is deliberately no `isAdminSolver` flag: the prototype's "admin
 * solver" is the `adminSolver` value of `user.role`, so elevation is decided
 * by access control (permissions.ts) instead of a second source of truth
 * this table would have to keep in sync.
 *
 * `batch` here is the solver's own graduating year (e.g. 24) — unrelated to
 * the `batches` table, which is the student cohort registry Achieve enrols
 * students into.
 */
export const solverProfiles = pgTable("solver_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  phone: text("phone").unique(),
  institution: text("institution"),
  dept: text("dept"),
  batch: integer("batch"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const solverProfilesRelations = relations(solverProfiles, ({ one }) => ({
  user: one(user, { fields: [solverProfiles.userId], references: [user.id] }),
}));
