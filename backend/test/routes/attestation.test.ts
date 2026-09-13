import { describe, expect, it } from "bun:test";
import { AttestationService } from "../../src/modules/attestation/attestation.service";
import { createTestClient } from "../helpers/test-client";

describe("API Route: /api/attestation", () => {
	it("POST /api/attestation/exchange returns a valid signed attestation token", async () => {
		const client = createTestClient();
		const res = await client.api.attestation.exchange.$post();

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(typeof data.token).toBe("string");

		const attestationService = new AttestationService();
		const isValid = await attestationService.verifyToken(data.token);
		expect(isValid).toBe(true);
	});

	it("works with an overridden mock attestation service in InferDI", async () => {
		const mockAttestation = {
			generateToken: async () => "mocked-token-12345",
			verifyToken: async (t: string) => t === "mocked-token-12345",
		};

		const client = createTestClient({ attestation: mockAttestation });
		const res = await client.api.attestation.exchange.$post();

		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.token).toBe("mocked-token-12345");
	});
});