import { describe, expect, it } from "bun:test";
import {
	constantTimeEqual,
	hashToken,
	initiatePayloadSchema,
	normalizePayload,
	randomToken,
} from "../src/lib/achieve-sso-plugin";

/**
 * Unit coverage for the Achieve SSO plugin's pure logic — the crypto and
 * payload-shaping code most likely to hide a subtle bug. The DB-touching
 * paths (batch lookup, user upsert, atomic single-use token consumption,
 * session creation) need a real Postgres to test meaningfully — the
 * existing hand-rolled node-postgres mock in test/helpers/auth-test-utils.ts
 * only recognises SQL against better-auth's own user/session/account tables,
 * not batches/student_profiles/achieve_sso_tokens, and extending it to fake
 * those convincingly would just be a second, less trustworthy database. That
 * gap is real and open, same as the rest of the suite's lack of integration
 * coverage against real Postgres (see the plan's Verification section).
 */

describe("constantTimeEqual", () => {
	it("returns true for identical strings", () => {
		expect(constantTimeEqual("shared-secret-value", "shared-secret-value")).toBe(true);
	});

	it("returns false for different strings of the same length", () => {
		expect(constantTimeEqual("shared-secret-value", "shared-secret-valuf")).toBe(false);
	});

	it("returns false for different-length strings without throwing", () => {
		// node's raw timingSafeEqual throws on unequal-length buffers — the
		// whole reason this compares sha256 digests instead of the raw
		// strings is so this never throws regardless of input length.
		expect(() => constantTimeEqual("short", "a-much-longer-string-entirely")).not.toThrow();
		expect(constantTimeEqual("short", "a-much-longer-string-entirely")).toBe(false);
	});

	it("returns false against an empty string", () => {
		expect(constantTimeEqual("", "shared-secret-value")).toBe(false);
	});
});

describe("randomToken", () => {
	it("produces a 64-character hex string (32 bytes / 256 bits)", () => {
		const token = randomToken();
		expect(token).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces a different token on every call", () => {
		const tokens = new Set(Array.from({ length: 20 }, () => randomToken()));
		expect(tokens.size).toBe(20);
	});
});

describe("hashToken", () => {
	it("is deterministic for the same input", () => {
		const token = randomToken();
		expect(hashToken(token)).toBe(hashToken(token));
	});

	it("produces a 64-character hex sha256 digest", () => {
		expect(hashToken("some-token")).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces different digests for different tokens", () => {
		expect(hashToken(randomToken())).not.toBe(hashToken(randomToken()));
	});

	it("never equals its own input (never stores the raw token as 'hashed')", () => {
		const token = randomToken();
		expect(hashToken(token)).not.toBe(token);
	});
});

describe("normalizePayload", () => {
	it("reads the documented capitalised keys", () => {
		const result = normalizePayload({
			Name: "Rahim Uddin",
			Email: "rahim@example.com",
			Phone: "+8801712345678",
			Institution: "Achieve",
			Batch: "hscfrb26",
		});
		expect(result).toEqual({
			name: "Rahim Uddin",
			email: "rahim@example.com",
			phone: "+8801712345678",
			institution: "Achieve",
			batch: "hscfrb26",
		});
	});

	it("falls back to lowercase keys", () => {
		const result = normalizePayload({
			name: "Rahim Uddin",
			email: "rahim@example.com",
			batch: "hscfrb26",
		});
		expect(result.name).toBe("Rahim Uddin");
		expect(result.email).toBe("rahim@example.com");
		expect(result.batch).toBe("hscfrb26");
	});

	it("prefers the capitalised key when both are present", () => {
		const result = normalizePayload({ Name: "Correct", name: "Wrong" });
		expect(result.name).toBe("Correct");
	});
});

describe("initiatePayloadSchema", () => {
	it("accepts a well-formed payload", () => {
		const result = initiatePayloadSchema.safeParse({
			name: "Rahim Uddin",
			email: "rahim@example.com",
			phone: "+8801712345678",
			institution: "Achieve",
			batch: "hscfrb26",
		});
		expect(result.success).toBe(true);
	});

	it("accepts a payload without the optional fields", () => {
		const result = initiatePayloadSchema.safeParse({
			name: "Rahim Uddin",
			email: "rahim@example.com",
			batch: "hscfrb26",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a missing name", () => {
		const result = initiatePayloadSchema.safeParse({
			email: "rahim@example.com",
			batch: "hscfrb26",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a malformed email", () => {
		const result = initiatePayloadSchema.safeParse({
			name: "Rahim Uddin",
			email: "not-an-email",
			batch: "hscfrb26",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a missing batch", () => {
		const result = initiatePayloadSchema.safeParse({
			name: "Rahim Uddin",
			email: "rahim@example.com",
		});
		expect(result.success).toBe(false);
	});
});
