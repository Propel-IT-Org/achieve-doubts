import type { Session, User } from "../../src/lib/auth";

export function createMockAuth(
	user: Partial<User> | null = null,
	session: Partial<Session> | null = null,
) {
	return {
		handler: async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
		api: {
			getSession: async (_req: { headers: Headers }) => {
				if (!user) return null;
				const fullUser: User = {
					id: user.id ?? "mock-user-id",
					name: user.name ?? "Mock User",
					email: user.email ?? "mock@example.com",
					emailVerified: true,
					role: user.role ?? "student",
					banned: user.banned ?? false,
					createdAt: new Date(),
					updatedAt: new Date(),
					...user,
				};
				const fullSession: Session = {
					id: session?.id ?? "mock-session-id",
					userId: fullUser.id,
					token: session?.token ?? "mock-session-token",
					expiresAt: new Date(Date.now() + 3600 * 1000),
					createdAt: new Date(),
					updatedAt: new Date(),
					...session,
				};
				return { user: fullUser, session: fullSession };
			},
		},
	};
}