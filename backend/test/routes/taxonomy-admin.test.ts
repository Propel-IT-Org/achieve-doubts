import { describe, expect, it } from "bun:test";
import { createMockAuth } from "../helpers/mock-auth";
import { createTestApp, createTestClient } from "../helpers/test-client";

/**
 * The routes, not the SQL: who may call them, what they accept, and how a
 * refusal from the service comes back. The service itself talks to Postgres
 * and is exercised against a real database, not here.
 */

const staff = createMockAuth({ id: "staff-1", role: "staff" });
const solver = createMockAuth({ id: "solver-1", role: "solver" });

/** Stands in for TaxonomyService: records the call, answers as told. */
function stubTaxonomy(answer: Record<string, unknown> = { row: { id: "class-7" } }) {
	const calls: Array<{ method: string; args: unknown[] }> = [];
	const record =
		(method: string) =>
		async (...args: unknown[]) => {
			calls.push({ method, args });
			return answer;
		};

	return {
		calls,
		createLevel: record("createLevel"),
		updateLevel: record("updateLevel"),
		deleteLevel: record("deleteLevel"),
		createSubject: record("createSubject"),
		updateSubject: record("updateSubject"),
		deleteSubject: record("deleteSubject"),
		createBook: record("createBook"),
		updateBook: record("updateBook"),
		deleteBook: record("deleteBook"),
		createChapter: record("createChapter"),
		updateChapter: record("updateChapter"),
		deleteChapter: record("deleteChapter"),
	};
}

describe("API Route: /api/admin/taxonomy", () => {
	it("creates a class for staff, defaulting its order", async () => {
		const taxonomy = stubTaxonomy();
		const client = createTestClient({ auth: staff, taxonomy });

		const res = await client.api.admin.taxonomy.levels.$post({
			json: { nameEn: "Class 7", nameBn: "সপ্তম শ্রেণি" },
		});

		expect(res.status).toBe(201);
		expect(taxonomy.calls[0]?.method).toBe("createLevel");
		expect(taxonomy.calls[0]?.args[0]).toEqual({
			nameEn: "Class 7",
			nameBn: "সপ্তম শ্রেণি",
			sort: 0,
		});
		// The actor is recorded, because every taxonomy write is audited.
		expect(taxonomy.calls[0]?.args[1]).toBe("staff-1");
	});

	// requireAuth and requirePermission answer before the handler, so their
	// statuses aren't among the route's inferred responses: these two go
	// through the raw app rather than the typed client.
	it("refuses a solver", async () => {
		const taxonomy = stubTaxonomy();
		const app = createTestApp({ auth: solver, taxonomy });

		const res = await app.request("/api/admin/taxonomy/levels", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ nameEn: "Class 7", nameBn: "সপ্তম শ্রেণি" }),
		});

		expect(res.status).toBe(403);
		expect(taxonomy.calls).toHaveLength(0);
	});

	it("refuses a guest", async () => {
		const app = createTestApp({ auth: createMockAuth(null), taxonomy: stubTaxonomy() });
		const res = await app.request("/api/admin/taxonomy/subjects", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ levelId: "class-7", nameEn: "Science", nameBn: "বিজ্ঞান" }),
		});
		expect(res.status).toBe(401);
	});

	it("rejects an empty name", async () => {
		const taxonomy = stubTaxonomy();
		const client = createTestClient({ auth: staff, taxonomy });

		const res = await client.api.admin.taxonomy.books.$post({
			json: { subjectId: "phy1", nameEn: "  ", nameBn: "বই" },
		});

		expect(res.status).toBe(400);
		expect(taxonomy.calls).toHaveLength(0);
	});

	it("rejects an update that changes nothing", async () => {
		const client = createTestClient({ auth: staff, taxonomy: stubTaxonomy() });
		const res = await client.api.admin.taxonomy.levels[":id"].$patch({
			param: { id: "class-7" },
			json: {},
		});
		expect(res.status).toBe(400);
	});

	it("turns a missing row into a 404 and a refusal into a 409", async () => {
		const missing = createTestClient({
			auth: staff,
			taxonomy: stubTaxonomy({ error: "Class not found" }),
		});
		const gone = await missing.api.admin.taxonomy.levels[":id"].$delete({
			param: { id: "class-7" },
		});
		expect(gone.status).toBe(404);

		const inUse = createTestClient({
			auth: staff,
			taxonomy: stubTaxonomy({ error: "2 questions are filed under this book" }),
		});
		const refused = await inUse.api.admin.taxonomy.books[":id"].$delete({
			param: { id: "phy1-tapan" },
		});
		expect(refused.status).toBe(409);
		expect(await refused.json()).toMatchObject({
			error: "2 questions are filed under this book",
		});
	});

	it("rejects a chapter id that isn't a positive integer", async () => {
		const taxonomy = stubTaxonomy();
		const client = createTestClient({ auth: staff, taxonomy });

		const res = await client.api.admin.taxonomy.chapters[":id"].$delete({
			param: { id: "abc" },
		});

		expect(res.status).toBe(400);
		expect(taxonomy.calls).toHaveLength(0);
	});

	it("passes a chapter's id through as a number", async () => {
		const taxonomy = stubTaxonomy();
		const client = createTestClient({ auth: staff, taxonomy });

		await client.api.admin.taxonomy.chapters[":id"].$patch({
			param: { id: "42" },
			json: { number: 3 },
		});

		expect(taxonomy.calls[0]?.args[0]).toBe(42);
	});
});
