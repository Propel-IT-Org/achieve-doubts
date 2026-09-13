import { describe, expect, it } from "bun:test";
import { container } from "../src/lib/di";

describe("Attestation Service", () => {
	it("generates and verifies valid attestation tokens", async () => {
		const attestation = container.get("attestation");

		const token = await attestation.generateToken(60);
		expect(typeof token).toBe("string");

		const isValid = await attestation.verifyToken(token);
		expect(isValid).toBe(true);
	});

	it("rejects corrupt or tampered tokens", async () => {
		const attestation = container.get("attestation");

		const token = await attestation.generateToken(60);
		const tampered = `${token}tampered`;

		const isValid = await attestation.verifyToken(tampered);
		expect(isValid).toBe(false);
	});

	it("rejects expired tokens", async () => {
		const attestation = container.get("attestation");

		const expiredToken = await attestation.generateToken(-10);
		const isValid = await attestation.verifyToken(expiredToken);
		expect(isValid).toBe(false);
	});
});