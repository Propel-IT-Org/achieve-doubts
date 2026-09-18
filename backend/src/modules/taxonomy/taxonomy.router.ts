import { Hono } from "hono";
import type { DB } from "../../db";
import { cached } from "../../lib/cache";
import type { AppEnv } from "../../lib/di";

/** The tree only changes when the seed runs, so a few minutes' staleness is harmless. */
const TTL_SECONDS = 300;

function loadTaxonomy(db: DB) {
	return db.query.subjects.findMany({
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
}

// Public: the whole subject -> book -> chapter tree the ask/filter UIs need,
// in one request. Every page that shows a question card loads it.
export const taxonomyRouter = new Hono<AppEnv>().get("/", async (c) => {
	const db = c.var.di.get("db");
	const rows = await cached("cache:taxonomy", TTL_SECONDS, () =>
		loadTaxonomy(db),
	);
	c.header("Cache-Control", `public, max-age=${TTL_SECONDS}`);
	return c.json(rows);
});
