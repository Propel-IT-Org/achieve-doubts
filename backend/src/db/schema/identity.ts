import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

// Profile data for role = "solver". `isAdminSolver` carries the prototype's
// `admin: true` flag — main-site moderation powers, distinct from `role`.
export const solverProfiles = pgTable("solver_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  phone: text("phone").unique(),
  institution: text("institution"),
  dept: text("dept"),
  batch: integer("batch"),
  isAdminSolver: boolean("is_admin_solver").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const solverProfilesRelations = relations(solverProfiles, ({ one }) => ({
  user: one(user, { fields: [solverProfiles.userId], references: [user.id] }),
}));
