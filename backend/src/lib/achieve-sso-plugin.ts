import { createHash, timingSafeEqual } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { env } from "../env";
import { clientIpFromHeaders } from "./client-ip";

const TOKEN_TTL_SECONDS = 90;

export const initiatePayloadSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
	phone: z.string().optional(),
	institution: z.string().optional(),
	batch: z.string().min(1),
});

/**
 * The documented payload uses capitalised keys (Name/Email/Phone/
 * Institution/Batch); accept lowercase too so a client-side casing choice
 * either way doesn't produce a hard-to-debug 400.
 */
export function normalizePayload(raw: Record<string, unknown>) {
	const pick = (a: string, b: string) => raw[a] ?? raw[b];
	return {
		name: pick("Name", "name"),
		email: pick("Email", "email"),
		phone: pick("Phone", "phone"),
		institution: pick("Institution", "institution"),
		batch: pick("Batch", "batch"),
	};
}

/** sha256-then-timingSafeEqual avoids both the length mismatch that makes
 * node's timingSafeEqual throw on unequal-length input, and a naive `!==`
 * comparison's early-exit timing leak. */
export function constantTimeEqual(a: string, b: string): boolean {
	const digestA = createHash("sha256").update(a).digest();
	const digestB = createHash("sha256").update(b).digest();
	return timingSafeEqual(digestA, digestB);
}

export function randomToken(): string {
	const bytes = new Uint8Array(32); // 256 bits — doc requires >=128
	crypto.getRandomValues(bytes);
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

function errorBody(errorCode: string, message: string) {
	return { status: "error" as const, error_code: errorCode, message };
}

function randomId(): string {
	return crypto.randomUUID();
}

interface BatchRow {
	id: string;
	active: boolean;
}

interface StudentProfileRow {
	id: string;
	userId: string;
}

interface ConsumedTokenRow {
	id: string;
	userId: string;
}

/**
 * Custom BetterAuthPlugin implementing the Achieve integration handshake
 * (docs/Achieve_DoubtSolving_Integration_Spec.pdf) — we are "the Provider".
 * Payload, response and error codes match the document exactly; only the
 * endpoint paths differ (they live under better-auth's own basePath, see
 * below). No off-the-shelf plugin fits: this is a bespoke server-to-server
 * token exchange, not OAuth2/OIDC.
 *
 * All custom-table access goes through `ctx.context.adapter` — the generic
 * model-agnostic CRUD interface better-auth exposes to every plugin — never
 * a closure-captured drizzle instance. The three models this plugin owns
 * (batches, studentProfiles, achieveSsoTokens) are declared below via the
 * plugin `schema` option; the actual physical tables are still defined in
 * drizzle (src/db/schema/identity.ts, achieve.ts) since they need real
 * migrations, but createAuth() registers them with `drizzleAdapter`'s own
 * `schema` map under the same model-name keys used here, so the adapter can
 * resolve `model: "achieveSsoTokens"` etc. to the right table.
 *
 * Single-use token consumption uses `adapter.consumeOne` — better-auth's own
 * race-safe "delete and return" primitive, explicitly documented for this
 * exact use case (verification tokens, one-time tokens). A token is
 * "consumed" simply by no longer existing; no separate consumedAt flag.
 */
export function achieveSsoPlugin(): BetterAuthPlugin {
	return {
		id: "achieve-sso",
		schema: {
			batches: {
				fields: {
					label: { type: "string", required: true },
					active: { type: "boolean", required: true },
					createdAt: { type: "date", required: true },
				},
			},
			studentProfiles: {
				fields: {
					userId: {
						type: "string",
						required: true,
						unique: true,
						references: { model: "user", field: "id", onDelete: "cascade" },
					},
					hscYear: { type: "number", required: false },
					college: { type: "string", required: false },
					district: { type: "string", required: false },
					phone: { type: "string", required: false },
					institution: { type: "string", required: false },
					batchId: {
						type: "string",
						required: false,
						references: { model: "batches", field: "id", onDelete: "set null" },
					},
					achieveKey: { type: "string", required: true, unique: true },
					createdAt: { type: "date", required: true },
					updatedAt: { type: "date", required: true },
				},
			},
			achieveSsoTokens: {
				fields: {
					tokenHash: { type: "string", required: true, unique: true },
					userId: {
						type: "string",
						required: true,
						references: { model: "user", field: "id", onDelete: "cascade" },
					},
					batchId: {
						type: "string",
						required: true,
						references: { model: "batches", field: "id", onDelete: "cascade" },
					},
					expiresAt: { type: "date", required: true },
					createdIp: { type: "string", required: false },
					createdAt: { type: "date", required: true },
				},
			},
		},
		endpoints: {
			// Mounted at /api/auth/achieve/sessions/initiate (better-auth's
			// basePath is /api/auth). Called only by Achieve's backend.
			achieveInitiateSession: createAuthEndpoint(
				"/achieve/sessions/initiate",
				{
					method: "POST",
					// Deliberately lenient here — real validation happens below with
					// initiatePayloadSchema, so every failure path can return the
					// exact documented { status, error_code, message } shape instead
					// of better-call's own generic validation-error response.
					body: z.record(z.string(), z.unknown()),
				},
				async (ctx) => {
					const providedSecret = ctx.request?.headers.get("x-achieve-auth") ?? "";
					if (!providedSecret || !constantTimeEqual(providedSecret, env.ACHIEVE_SHARED_SECRET)) {
						throw new APIError(
							401,
							errorBody("INVALID_AUTH", "Invalid or missing X-Achieve-Auth header."),
						);
					}

					const parsed = initiatePayloadSchema.safeParse(normalizePayload(ctx.body));
					if (!parsed.success) {
						throw new APIError(
							400,
							errorBody(
								"INVALID_PAYLOAD",
								"One or more required fields are missing or malformed.",
							),
						);
					}
					const { name, email, phone, institution, batch: batchId } = parsed.data;
					const normalizedEmail = email.toLowerCase();

					// Everything from here on touches the database — one try/catch so
					// any unexpected failure (not just the upsert path) still returns
					// the documented 500 INTERNAL_ERROR shape instead of an unhandled
					// framework-level error.
					try {
						const batch = await ctx.context.adapter.findOne<BatchRow>({
							model: "batches",
							where: [{ field: "id", value: batchId }],
						});
						if (!batch || !batch.active) {
							throw new APIError(
								404,
								errorBody("UNKNOWN_BATCH", "The supplied batch does not exist."),
							);
						}

						// achieveKey = normalized email today — the specific unique key
						// Achieve and we agree on is still a field gap to settle (see
						// Part 4 of the plan); this is the one place that changes if it
						// turns out to be something else (e.g. Phone).
						const existingProfile = await ctx.context.adapter.findOne<StudentProfileRow>({
							model: "studentProfiles",
							where: [{ field: "achieveKey", value: normalizedEmail }],
						});

						let userId: string;
						let userStatus: "existing" | "new";

						if (existingProfile) {
							userId = existingProfile.userId;
							userStatus = "existing";
							// Upsert on every handshake, not just on first contact, so
							// profile changes on Achieve's side propagate here.
							await ctx.context.adapter.update({
								model: "user",
								where: [{ field: "id", value: userId }],
								update: { name },
							});
							await ctx.context.adapter.update({
								model: "studentProfiles",
								where: [{ field: "userId", value: userId }],
								update: { phone, institution, batchId },
							});
						} else {
							const conflictingUser =
								await ctx.context.internalAdapter.findUserByEmail(normalizedEmail);
							if (conflictingUser) {
								// This email already belongs to a non-student account (e.g.
								// a solver/staff login) — refuse rather than silently
								// attaching a student profile to someone else's account.
								console.error(
									`[achieve-sso] ${normalizedEmail} already belongs to a non-student account`,
								);
								throw new APIError(
									500,
									errorBody("INTERNAL_ERROR", "Unable to complete sign-in."),
								);
							}

							const created = await ctx.context.internalAdapter.createUser(
								{ name, email: normalizedEmail, emailVerified: true, role: "student" },
								{ method: "achieve-sso" },
							);
							userId = created.id;
							userStatus = "new";
							await ctx.context.adapter.create({
								model: "studentProfiles",
								data: {
									id: randomId(),
									userId,
									phone,
									institution,
									batchId,
									achieveKey: normalizedEmail,
									createdAt: new Date(),
									updatedAt: new Date(),
								},
								forceAllowId: true,
							});
						}

						const token = randomToken();
						await ctx.context.adapter.create({
							model: "achieveSsoTokens",
							data: {
								id: randomId(),
								tokenHash: hashToken(token),
								userId,
								batchId,
								expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000),
								createdIp: ctx.request
									? clientIpFromHeaders(ctx.request.headers)
									: null,
								createdAt: new Date(),
							},
							forceAllowId: true,
						});

						const redirectUrl = new URL("/api/auth/achieve/sso", env.BETTER_AUTH_URL);
						redirectUrl.searchParams.set("token", token);

						return ctx.json({
							status: "success" as const,
							user_status: userStatus,
							redirect_url: redirectUrl.toString(),
						});
					} catch (err) {
						// Our own documented error responses are already the right
						// shape and status — only genuinely unexpected failures (a real
						// DB error, etc.) get folded into the generic 500 below.
						if (err instanceof APIError) throw err;
						console.error("[achieve-sso] initiate failed", err);
						throw new APIError(
							500,
							errorBody("INTERNAL_ERROR", "Unexpected server error."),
						);
					}
				},
			),

			// Mounted at /api/auth/achieve/sso. The browser lands here after
			// Achieve redirects the student; consumes the token and signs them in.
			achieveConsumeSession: createAuthEndpoint(
				"/achieve/sso",
				{
					method: "GET",
					query: z.object({ token: z.string().min(1).optional() }),
				},
				async (ctx) => {
					const token = ctx.query.token;
					if (!token) {
						throw ctx.redirect(`${env.CORS_ORIGIN}/?ssoError=missing_token`);
					}

					// Atomic delete-and-return: better-auth's own race-safe primitive
					// for single-use credentials — exactly one concurrent caller ever
					// receives the row, everyone else gets null. A token is "consumed"
					// simply by no longer existing; there's no separate flag to check.
					const consumed = await ctx.context.adapter.consumeOne<ConsumedTokenRow>({
						model: "achieveSsoTokens",
						where: [
							{ field: "tokenHash", value: hashToken(token) },
							{ field: "expiresAt", operator: "gt", value: new Date() },
						],
					});

					if (!consumed) {
						throw ctx.redirect(`${env.CORS_ORIGIN}/?ssoError=expired_or_invalid`);
					}

					const foundUser = await ctx.context.internalAdapter.findUserById(consumed.userId);
					if (!foundUser) {
						throw ctx.redirect(`${env.CORS_ORIGIN}/?ssoError=expired_or_invalid`);
					}

					// dontRememberMe defaults to false/undefined here, i.e. a normal
					// persistent session — not the `createSession(userId, ctx)`
					// mistake that would have passed a truthy second argument.
					const session = await ctx.context.internalAdapter.createSession(foundUser.id);
					await setSessionCookie(ctx, { session, user: foundUser });

					throw ctx.redirect(`${env.CORS_ORIGIN}/`);
				},
			),
		},
	} satisfies BetterAuthPlugin;
}
