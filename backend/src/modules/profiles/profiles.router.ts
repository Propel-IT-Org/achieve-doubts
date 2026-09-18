import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import type { DB } from "../../db";
import { cached } from "../../lib/cache";
import type { AppEnv } from "../../lib/di";
import { fail } from "../../lib/errors";
import {
  lockEvents,
  questions,
  solutions,
  solverProfiles,
  studentProfiles,
  user,
} from "../../db/schema";
import { requireAuth, requirePermission } from "../../middleware/auth";
import {
  computeSolverStats,
  FOLLOWUP_LIMIT,
  isLockBlocked,
  listPendingFollowups,
} from "./solver-stats.util";

/**
 * Public profiles deliberately expose no contact details (email, phone) and
 * no role information — the prototype's profile screens show academic and
 * activity data only.
 */
export const profilesRouter = new Hono<AppEnv>()
  .get("/students/:id", async (c) => {
    const id = c.req.param("id");
    const db = c.var.di.get("db");

    const row = await db
      .select({
        id: user.id,
        name: user.name,
        joinedAt: user.createdAt,
        hscYear: studentProfiles.hscYear,
        college: studentProfiles.college,
        district: studentProfiles.district,
      })
      .from(user)
      .leftJoin(studentProfiles, eq(studentProfiles.userId, user.id))
      .where(and(eq(user.id, id), eq(user.role, "student")))
      .then((rows) => rows[0]);

    if (!row) return fail(c, 404, "NOT_FOUND", "Student not found");

    const [stats] = await db
      .select({
        asked: sql<number>`count(*)`,
        answered: sql<number>`count(*) filter (where ${questions.status} in ('answered','satisfied','unsatisfied'))`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
        avgMatchSec: sql<string | null>`avg(${questions.matchedAfterSec})`,
      })
      .from(questions)
      .where(and(eq(questions.askerId, id), isNull(questions.deletedAt)));

    const satisfied = Number(stats?.satisfied ?? 0);
    const unsatisfied = Number(stats?.unsatisfied ?? 0);

    const recent = await db
      .select()
      .from(questions)
      .where(and(eq(questions.askerId, id), isNull(questions.deletedAt)))
      .orderBy(desc(questions.askedAt))
      .limit(6);

    return c.json({
      ...row,
      asked: Number(stats?.asked ?? 0),
      answered: Number(stats?.answered ?? 0),
      satisfactionRate:
        satisfied + unsatisfied > 0
          ? satisfied / (satisfied + unsatisfied)
          : null,
      avgMatchSeconds: stats?.avgMatchSec ? Number(stats.avgMatchSec) : null,
      recentQuestions: recent,
    });
  })
  .get("/solvers/:id", async (c) => {
    const id = c.req.param("id");
    const db = c.var.di.get("db");

    const row = await db
      .select({
        id: user.id,
        name: user.name,
        joinedAt: user.createdAt,
        institution: solverProfiles.institution,
        dept: solverProfiles.dept,
        batch: solverProfiles.batch,
      })
      .from(user)
      .leftJoin(solverProfiles, eq(solverProfiles.userId, user.id))
      .where(and(eq(user.id, id), sql`${user.role} in ('solver','adminSolver')`))
      .then((rows) => rows[0]);

    if (!row) return fail(c, 404, "NOT_FOUND", "Solver not found");

    const stats = await computeSolverStats(db, id);

    const recent = await db
      .select()
      .from(questions)
      .innerJoin(solutions, eq(solutions.questionId, questions.id))
      .where(
        and(
          eq(questions.solverId, id),
          isNull(questions.deletedAt),
          isNull(solutions.deletedAt),
        ),
      )
      .orderBy(desc(solutions.createdAt))
      .limit(6);

    return c.json({
      ...row,
      ...stats,
      recentlySolved: recent.map((r) => r.questions),
    });
  })
  .get(
    "/me/solver/dashboard",
    requireAuth,
    requirePermission({ question: ["claim"] }),
    async (c) => {
      const db = c.var.di.get("db");
      const solverId = c.var.user.id;

      const stats = await computeSolverStats(db, solverId);

      const [lockCounts] = await db
        .select({
          locked: sql<number>`count(*) filter (where ${lockEvents.action} = 'lock')`,
          unlocked: sql<number>`count(*) filter (where ${lockEvents.action} = 'unlock')`,
        })
        .from(lockEvents)
        .where(eq(lockEvents.solverId, solverId));

      const locked = Number(lockCounts?.locked ?? 0);
      const unlocked = Number(lockCounts?.unlocked ?? 0);

      const [openRow] = await db
        .select({ n: sql<number>`count(*)` })
        .from(questions)
        .where(
          and(eq(questions.status, "waiting"), isNull(questions.deletedAt)),
        );

      const myLocked = await db
        .select()
        .from(questions)
        .where(
          and(
            eq(questions.solverId, solverId),
            eq(questions.status, "assigned"),
            isNull(questions.deletedAt),
          ),
        );

      const pending = await listPendingFollowups(db, solverId);

      const recent = await db
        .select()
        .from(questions)
        .innerJoin(solutions, eq(solutions.questionId, questions.id))
        .where(
          and(
            eq(questions.solverId, solverId),
            isNull(questions.deletedAt),
            isNull(solutions.deletedAt),
          ),
        )
        .orderBy(desc(solutions.createdAt))
        .limit(4);

      return c.json({
        ...stats,
        locked,
        unlocked,
        unlockRate: locked > 0 ? unlocked / locked : null,
        openQuestions: Number(openRow?.n ?? 0),
        lockedByMe: myLocked,
        pendingFollowups: pending,
        // The rule lives here, so the dashboard never re-derives it.
        followupLimit: FOLLOWUP_LIMIT,
        lockBlocked: isLockBlocked(pending.length),
        recentlySolved: recent.map((r) => r.questions),
      });
    },
  )
  .get("/stats/home", async (c) => {
    const db = c.var.di.get("db");
    // Public, fetched on every home page view, and three aggregate scans over
    // whole tables — nobody needs these figures to the second.
    const stats = await cached("cache:stats:home", HOME_STATS_TTL, () =>
      computeHomeStats(db),
    );
    c.header("Cache-Control", `public, max-age=${HOME_STATS_TTL}`);
    return c.json(stats);
  });

const HOME_STATS_TTL = 60;

async function computeHomeStats(db: DB) {
  const [agg] = await db
    .select({
      solved: sql<number>`count(*) filter (where ${questions.status} in ('answered','satisfied','unsatisfied'))`,
      satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
      unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
      medianMatchSec: sql<
        string | null
      >`percentile_cont(0.5) within group (order by ${questions.matchedAfterSec}) filter (where ${questions.matchedAfterSec} is not null)`,
    })
    .from(questions)
    .where(isNull(questions.deletedAt));

  const [answerTime] = await db
    .select({
      medianAnswerMin: sql<
        string | null
      >`percentile_cont(0.5) within group (order by extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)`,
    })
    .from(solutions)
    .innerJoin(questions, eq(solutions.questionId, questions.id))
    .where(
      and(isNull(solutions.deletedAt), sql`${questions.lockedAt} is not null`),
    );

  // No presence tracking exists in this system — this is a stand-in for
  // "solvers online", not a live count.
  const [solverCount] = await db
    .select({ n: sql<number>`count(*)` })
    .from(user)
    .where(
      and(
        sql`${user.role} in ('solver','adminSolver')`,
        sql`coalesce(${user.banned}, false) = false`,
      ),
    );

  const satisfied = Number(agg?.satisfied ?? 0);
  const unsatisfied = Number(agg?.unsatisfied ?? 0);

  return {
    solved: Number(agg?.solved ?? 0),
    satisfactionRate:
      satisfied + unsatisfied > 0
        ? satisfied / (satisfied + unsatisfied)
        : null,
    medianMatchSeconds: agg?.medianMatchSec
      ? Number(agg.medianMatchSec)
      : null,
    medianAnswerMinutes: answerTime?.medianAnswerMin
      ? Number(answerTime.medianAnswerMin)
      : null,
    solversAvailable: Number(solverCount?.n ?? 0),
  };
}
