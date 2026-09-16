import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "../auth-schema";
import { lockActionEnum } from "./enums";
import { questions } from "./questions";

// Every lock/unlock/override/expire transition — source of truth for the
// solver dashboard's "questions locked" / "unlock rate" and an audit trail.
export const lockEvents = pgTable("lock_events", {
	id: serial("id").primaryKey(),
	questionId: integer("question_id")
		.notNull()
		.references(() => questions.id, { onDelete: "cascade" }),
	solverId: text("solver_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	action: lockActionEnum("action").notNull(),
	at: timestamp("at").defaultNow().notNull(),
});

// Every admin delete, lock override, deactivation and report resolution.
export const auditLog = pgTable("audit_log", {
	id: serial("id").primaryKey(),
	actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
	action: text("action").notNull(),
	entityType: text("entity_type").notNull(),
	entityId: text("entity_id").notNull(),
	meta: jsonb("meta"),
	at: timestamp("at").defaultNow().notNull(),
});

// How many questions a student may ask. Both limits NULL = unlimited
// (the default). Seeded with a single global row; scope is reserved for a
// future per-batch/per-plan override.
export const askQuotaPolicies = pgTable("ask_quota_policies", {
	id: serial("id").primaryKey(),
	scope: text("scope").notNull().default("global"),
	maxPerDay: integer("max_per_day"),
	maxPerMonth: integer("max_per_month"),
	active: boolean("active").notNull().default(true),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => new Date())
		.notNull(),
});
