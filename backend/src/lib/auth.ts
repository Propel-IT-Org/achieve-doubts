import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import type { DB } from "../db";
import * as schema from "../db/schema";
import { env } from "../env";
import { ac, roles } from "./permissions";

export function createAuth(database: DB) {
	return betterAuth({
		database: drizzleAdapter(database, {
			provider: "pg",
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		emailAndPassword: {
			enabled: true,
		},
		trustedOrigins: [env.CORS_ORIGIN],
		plugins: [
			admin({
				ac,
				roles,
				defaultRole: "student",
				adminRoles: ["admin"],
			}),
		],
	});
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"]["session"];
export type User = Auth["$Infer"]["Session"]["user"];
