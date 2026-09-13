import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
	doubt: ["create", "read", "update", "delete", "claim", "release"],
	solution: ["create", "read", "update", "delete"],
	user: ["read", "manage"],
} as const;

export const ac = createAccessControl(statement);

export const student = ac.newRole({
	doubt: ["create", "read", "update", "delete"],
	solution: ["read"],
	user: ["read"],
});

export const solver = ac.newRole({
	doubt: ["read", "claim", "release"],
	solution: ["create", "read", "update"],
	user: ["read"],
});

export const adminRole = ac.newRole({
	doubt: ["create", "read", "update", "delete", "claim", "release"],
	solution: ["create", "read", "update", "delete"],
	user: ["read", "manage"],
});

export const roles = {
	student,
	solver,
	admin: adminRole,
};

export type AppRole = keyof typeof roles;
