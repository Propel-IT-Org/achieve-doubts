import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * The full universe of entity/action pairs checkable via requirePermission.
 *
 * "Admin solver" is a real role here, not a flag on top of another role:
 * `user.role` holds exactly one of the four AppRole values below. That keeps
 * every authorization decision inside better-auth's access control — a route
 * gates on the *verb* it needs (`question: ["override"]`) and never has to
 * ask the database whether this particular solver is elevated.
 */
export const statement = {
	question: ["create", "list", "claim", "release", "override", "delete"],
	solution: ["create", "list", "delete"],
	thread: ["create", "list", "delete"],
	comment: ["create", "list", "delete"],
	report: ["create", "list", "resolve"],
	rating: ["create"],
	notification: ["list", "update"],
	payout: ["list", "generate", "markPaid"],
	analytics: ["list"],
	batch: ["create", "list", "update"],
	solverProfile: ["create", "list", "update"],
	studentProfile: ["list", "update"],
	...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const student = ac.newRole({
	question: ["create", "list"],
	solution: ["list"],
	thread: ["create", "list"],
	comment: ["create", "list"],
	report: ["create", "list"],
	rating: ["create"],
	notification: ["list", "update"],
});

export const solver = ac.newRole({
	question: ["list", "claim", "release"],
	// "delete" is a solver's OWN solution — the AC layer proves the verb is in
	// scope for the role; ownership is enforced in the service layer.
	solution: ["create", "list", "delete"],
	thread: ["create", "list"],
	// Deliberately no comment:create — the public comment thread is for
	// students; solvers reply in the private follow-up thread instead.
	comment: ["list"],
	notification: ["list", "update"],
});

/**
 * The prototype's "admin solver": a solver with main-site moderation powers —
 * take over another solver's lock, and delete any question/solution/thread
 * message/comment.
 */
export const adminSolver = ac.newRole({
	question: ["list", "claim", "release", "override", "delete"],
	solution: ["create", "list", "delete"],
	thread: ["create", "list", "delete"],
	comment: ["list", "delete"],
	notification: ["list", "update"],
});

export const staff = ac.newRole({
	question: ["create", "list", "claim", "release", "override", "delete"],
	solution: ["create", "list", "delete"],
	thread: ["create", "list", "delete"],
	comment: ["create", "list", "delete"],
	report: ["create", "list", "resolve"],
	rating: ["create"],
	notification: ["list", "update"],
	payout: ["list", "generate", "markPaid"],
	analytics: ["list"],
	batch: ["create", "list", "update"],
	solverProfile: ["create", "list", "update"],
	studentProfile: ["list", "update"],
	...adminAc.statements,
});

export const roles = { student, solver, adminSolver, staff };

export type AppRole = keyof typeof roles;

/** Roles that can hold a lock and answer questions. */
export const SOLVER_ROLES: AppRole[] = ["solver", "adminSolver", "staff"];
