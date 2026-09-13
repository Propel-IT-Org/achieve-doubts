import { testClient } from "hono/testing";
import { createApp } from "../../src/index";
import { buildContainer } from "../../src/lib/di";

export function createTestApp(overrides?: Record<string, unknown>) {
	let c = buildContainer();
	if (overrides) {
		for (const [key, value] of Object.entries(overrides)) {
			c = c.override(key as never, value as never);
		}
	}
	return createApp(c);
}

export function createTestClient(overrides?: Record<string, unknown>) {
	const app = createTestApp(overrides);
	return testClient(app);
}