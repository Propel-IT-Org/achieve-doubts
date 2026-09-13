import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { testUtils } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/db/schema";
import { env } from "../../src/env";

export function createMockDrizzleAuthDb() {
	const mockDb = drizzle.mock({ schema });
	const users = new Map<string, Record<string, unknown>>();
	const sessions = new Map<string, Record<string, unknown>>();

	mockDb.session.client.query = async (
		queryObj: string | { text: string; values?: unknown[] },
		params: unknown[] = [],
	) => {
		const text = (
			typeof queryObj === "string" ? queryObj : queryObj.text
		).toLowerCase();
		const p =
			typeof queryObj === "object" && queryObj.values
				? queryObj.values
				: params;

		if (text.startsWith('delete from "user"')) {
			if (p.length > 0) users.delete(p[0] as string);
			return { rows: [], rowCount: 1 };
		}

		if (text.startsWith('delete from "session"')) {
			if (p.length > 0) {
				for (const [key, s] of sessions.entries()) {
					if (s.token === p[0] || s.user_id === p[0] || s.id === p[0]) {
						sessions.delete(key);
					}
				}
			}
			return { rows: [], rowCount: 1 };
		}

		if (text.startsWith('delete from "account"')) {
			return { rows: [], rowCount: 1 };
		}

		if (text.startsWith('insert into "user"')) {
			const u = {
				id: p[0] as string,
				name: p[1] as string,
				email: p[2] as string,
				email_verified: p[3] as boolean,
				image: (p[4] as string) || null,
				created_at: (p[5] as Date) || new Date(),
				updated_at: (p[6] as Date) || new Date(),
				role: (p[7] as string) || "student",
				banned: false,
				ban_reason: null,
				ban_expires: null,
			};
			users.set(u.id, u);
			return {
				rows: [[u.id, u.name, u.email, u.email_verified, u.image, u.created_at, u.updated_at, u.role, u.banned, u.ban_reason, u.ban_expires]],
				rowCount: 1,
			};
		}

		if (text.startsWith("select") && text.includes('"user"')) {
			let matched = Array.from(users.values());
			if (p.length > 0) {
				matched = matched.filter((u) => u.id === p[0] || u.email === p[0]);
			}
			const rows = matched.map((u) => [
				u.id, u.name, u.email, u.email_verified, u.image,
				u.created_at, u.updated_at, u.role, u.banned, u.ban_reason, u.ban_expires,
			]);
			return { rows, rowCount: rows.length };
		}

		if (text.startsWith('insert into "session"')) {
			const s = {
				id: p[0] as string,
				expires_at: p[1] as Date,
				token: p[2] as string,
				created_at: (p[3] as Date) || new Date(),
				updated_at: (p[4] as Date) || new Date(),
				ip_address: (p[5] as string) || null,
				user_agent: (p[6] as string) || null,
				user_id: p[7] as string,
				impersonated_by: (p[8] as string) || null,
			};
			sessions.set(s.token, s);
			sessions.set(s.id, s);
			return {
				rows: [[s.id, s.expires_at, s.token, s.created_at, s.updated_at, s.ip_address, s.user_agent, s.user_id, s.impersonated_by]],
				rowCount: 1,
			};
		}

		if (text.startsWith("select") && text.includes('"session"')) {
			let matched = Array.from(new Set(sessions.values()));
			if (p.length > 0) {
				matched = matched.filter(
					(s) => s.token === p[0] || s.user_id === p[0] || s.id === p[0],
				);
			}
			const rows = matched.map((s) => [
				s.id, s.expires_at, s.token, s.created_at, s.updated_at,
				s.ip_address, s.user_agent, s.user_id, s.impersonated_by,
			]);
			return { rows, rowCount: rows.length };
		}

		return { rows: [], rowCount: 0 };
	};

	return { mockDb, users, sessions };
}

export async function createBetterAuthTest() {
	const { mockDb, users, sessions } = createMockDrizzleAuthDb();

	const auth = betterAuth({
		database: drizzleAdapter(mockDb, {
			provider: "pg",
			schema: {
				user: schema.user,
				session: schema.session,
				account: schema.account,
				verification: schema.verification,
			},
		}),
		secret: env.BETTER_AUTH_SECRET || "mock-secret-at-least-32-chars-long",
		baseURL: env.BETTER_AUTH_URL || "http://localhost:3000",
		plugins: [testUtils()],
	});

	const ctx = await auth.$context;
	return { auth, test: ctx.test, mockDb, users, sessions };
}