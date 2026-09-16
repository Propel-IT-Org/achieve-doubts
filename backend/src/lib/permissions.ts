import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * The full universe of entity/action pairs checkable via requirePermission.
 * `user.role` only ever stores one of the three literal AppRole values below
 * — "admin solver" is NOT a fourth role. It's a per-solver elevation flag
 * (solver_profiles.isAdminSolver) checked by the bespoke requireAdminSolver
 * middleware (middleware/auth.ts), not by this AC/role system, because
 * better-auth's access control resolves purely by the literal `role` column
 * and has no notion of a sub-flag on top of a role.
 */
export const statement = {
	question: ["create", "list", "claim", "release", "delete"],
	solution: ["create", "list", "delete"],
	thread: ["create", "list", "delete"],
	comment: ["create", "list", "delete"],
	report: ["create", "list", "resolve"],
	rating: ["create"],
	payout: ["list", "generate", "markPaid"],
	analytics: ["list"],
	batch: ["create", "list", "update"],
	solverAccount: ["create", "list", "update"],
	studentAccount: ["list", "update"],
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
});

export const solver = ac.newRole({
	question: ["list", "claim", "release"],
	// "delete" here is a solver's OWN solution only — the AC layer just
	// proves the verb is in scope for the role; ownership is enforced in
	// the service layer, same as it was for the original doubts module.
	solution: ["create", "list", "delete"],
	thread: ["create", "list"],
	comment: ["list"],
});

export const staff = ac.newRole({
	question: ["create", "list", "claim", "release", "delete"],
	solution: ["create", "list", "delete"],
	thread: ["create", "list", "delete"],
	comment: ["create", "list", "delete"],
	report: ["create", "list", "resolve"],
	rating: ["create"],
	payout: ["list", "generate", "markPaid"],
	analytics: ["list"],
	batch: ["create", "list", "update"],
	solverAccount: ["create", "list", "update"],
	studentAccount: ["list", "update"],
	...adminAc.statements,
});

export const roles = { student, solver, staff };

export type AppRole = keyof typeof roles;
