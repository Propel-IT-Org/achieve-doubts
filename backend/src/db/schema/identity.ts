import { relations } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { user } from "../auth-schema";

// A student's enrolled cohort as registered with Achieve, e.g. "hscfrb26".
// Required so the integration handshake can validate `Batch` and return the
// documented 404 UNKNOWN_BATCH instead of silently accepting anything.
export const batches = pgTable("batches", {
	id: varchar("id", { length: 64 }).primaryKey(),
	label: text("label").notNull(),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Profile data for role = "student". Every field here is supplied by Achieve
// server-to-server (see lib/achieve-sso-plugin.ts) — never student-editable.
export const studentProfiles = pgTable("student_profiles", {
	userId: text("user_id")
		.primaryKey()
		.references(() => user.id, { onDelete: "cascade" }),
	hscYear: integer("hsc_year"),
	college: text("college"),
	district: text("district"),
	phone: text("phone"),
	institution: text("institution"),
	batchId: varchar("batch_id", { length: 64 }).references(() => batches.id, {
		onDelete: "set null",
	}),
	// The field Achieve and we agree maps one Achieve student to exactly one
	// user here (defaults to email — see achieve-sso-plugin.ts for the actual
	// key negotiated). This is what "no duplicate accounts" hangs on.
	achieveKey: text("achieve_key").notNull().unique(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});

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

export const batchesRelations = relations(batches, ({ many }) => ({
	students: many(studentProfiles),
}));

export const studentProfilesRelations = relations(studentProfiles, ({ one }) => ({
	user: one(user, { fields: [studentProfiles.userId], references: [user.id] }),
	batch: one(batches, { fields: [studentProfiles.batchId], references: [batches.id] }),
}));

export const solverProfilesRelations = relations(solverProfiles, ({ one }) => ({
	user: one(user, { fields: [solverProfiles.userId], references: [user.id] }),
}));
