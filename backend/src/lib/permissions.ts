import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const statement = {
  doubt: ["create", "list", "update", "delete", "claim", "release"],
  solution: ["create", "list", "update", "delete"],
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const student = ac.newRole({
  doubt: ["create", "list", "update", "delete"],
  solution: ["list"],
  user: ["list"],
});

export const solver = ac.newRole({
  doubt: ["list", "claim", "release"],
  solution: ["create", "list", "update"],
  user: ["list"],
});

export const adminRole = ac.newRole({
  doubt: ["create", "list", "update", "delete", "claim", "release"],
  solution: ["create", "list", "update", "delete"],
  ...adminAc.statements,
});

export const roles = {
  student,
  solver,
  admin: adminRole,
};

export type AppRole = keyof typeof roles;
