import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";

// Public, cache-friendly: the whole subject -> book -> chapter tree the
// ask/filter UIs need in one request.
export const taxonomyRouter = new Hono<AppEnv>().get("/", async (c) => {
	const db = c.var.di.get("db");
	const rows = await db.query.subjects.findMany({
		orderBy: (s, { asc }) => [asc(s.sort)],
		with: {
			books: {
				orderBy: (b, { asc }) => [asc(b.sort)],
				with: {
					chapters: {
						orderBy: (ch, { asc }) => [asc(ch.number)],
					},
				},
			},
		},
	});
	return c.json(rows);
});
