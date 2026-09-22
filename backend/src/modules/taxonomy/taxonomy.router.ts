import { Hono } from "hono";
import type { AppEnv } from "../../lib/di";
import { optionalAuth } from "../../middleware/auth";

/** Staff edits drop the server cache; this only bounds the browser's copy. */
const TTL_SECONDS = 300;

// Two reads of the one level -> subject -> book -> chapter tree:
//
//   GET /          every class. What any page uses to name a question — the
//                  question list is public across classes, so a student's
//                  own class alone can't label every card they see.
//   GET /mine      what the caller may ask under and filter by: a student
//                  gets their batch's class only, everyone else every class.
//
// Both come grouped and ordered from the query; no client filters them.
export const taxonomyRouter = new Hono<AppEnv>()
	.get("/", async (c) => {
		c.header("Cache-Control", `public, max-age=${TTL_SECONDS}`);
		return c.json(await c.var.di.get("taxonomy").tree(null));
	})
	.get("/mine", optionalAuth, async (c) => {
		const taxonomy = c.var.di.get("taxonomy");
		const user = c.var.user;
		const levelId = user ? await taxonomy.levelForUser(user.id) : null;

		// Private, always: the same URL answers differently per student, and
		// a shared cache has no business holding one student's syllabus.
		c.header("Cache-Control", `private, max-age=${TTL_SECONDS}`);
		c.header("Vary", "Cookie");
		return c.json(await taxonomy.tree(levelId));
	});
