import { describe, expect, it } from "bun:test";
import { container } from "../src/lib/di";

describe("Upload Service", () => {
	it("generates presigned upload URLs with correct userId paths", async () => {
		const upload = container.get("upload");
		const userId = "test-user-123";

		const result = await upload.createPresignedUpload(
			"diagram.png",
			"image/png",
			userId,
		);

		expect(result.uploadUrl).toBeDefined();
		expect(result.publicUrl).toBeDefined();
		expect(result.key).toContain(`uploads/${userId}/`);
		expect(result.key.endsWith(".png")).toBe(true);
	});
});