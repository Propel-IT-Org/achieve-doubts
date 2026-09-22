import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { optionalAuth } from "../../middleware/auth";

/** The tree only changes when the seed runs, so a few minutes' staleness is harmless. */
const TTL_SECONDS = 300;

// Public: the whole level -> subject -> book -> chapter tree the ask and
// filter UIs need, in one request. Every page that shows a question card
// loads it.
//
// A signed-in student gets their batch's level only, so they can neither ask
// outside their syllabus nor be offered another class's chapters. Guests,
// solvers and staff get every level, grouped, because they read across all
// of them.
export const taxonomyRouter = new Hono<AppEnv>().get(
	"/",
	optionalAuth,
	async (c) => {
		const taxonomy = c.var.di.get("taxonomy");
		const user = c.var.user;
		const levelId = user ? await taxonomy.levelForUser(user.id) : null;

		// Private, always: the same URL answers differently per student, and
		// a shared cache has no business holding one student's syllabus.
		c.header("Cache-Control", `private, max-age=${TTL_SECONDS}`);
		c.header("Vary", "Cookie");
		return c.json(await taxonomy.tree(levelId));
	},
);
