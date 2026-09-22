import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { optionalAuth } from "../../middleware/auth";

/** The tree only changes when the seed runs, so a few minutes' staleness is harmless. */
const TTL_SECONDS = 300;

// Public: the whole subject -> book -> chapter tree the ask/filter UIs need,
// in one request. Every page that shows a question card loads it.
//
// A signed-in student gets their batch's level only, so they can neither ask
// outside their syllabus nor be offered another class's chapters. Guests,
// solvers and staff get every level — they read across all of them, which is
// why each subject carries the level it belongs to.
export const taxonomyRouter = new Hono<AppEnv>().get(
	"/",
	optionalAuth,
	async (c) => {
		const taxonomy = c.var.di.get("taxonomy");
		const user = c.var.user;
		const levelId = user ? await taxonomy.levelForUser(user.id) : null;

		c.header(
			"Cache-Control",
			`${levelId ? "private" : "public"}, max-age=${TTL_SECONDS}`,
		);
		return c.json(await taxonomy.tree(levelId));
	},
);
