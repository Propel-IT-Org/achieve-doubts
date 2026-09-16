import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DB } from "../../db";
import { questions, solutions, threadMessages } from "../../db/schema";

/**
 * Aggregation shared by the public solver profile, the solver's own
 * dashboard, and the staff solver list — kept in one place so
 * "solved / satisfaction / response time" and the follow-up-block rule mean
 * the same thing everywhere they're computed.
 */

export interface SolverStats {
  solved: number;
  satisfied: number;
  unsatisfied: number;
  satisfactionRate: number | null;
  avgResponseMinutes: number | null;
}

export async function computeSolverStats(
  db: DB,
  solverId: string,
): Promise<SolverStats> {
  const [counts] = await db
    .select({
      solved: sql<number>`count(*) filter (where ${questions.status} in ('answered','satisfied','unsatisfied'))`,
      satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
      unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
    })
    .from(questions)
    .where(and(eq(questions.solverId, solverId), isNull(questions.deletedAt)));

  const [resp] = await db
    .select({
      avgMinutes: sql<
        string | null
      >`avg(extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)`,
    })
    .from(solutions)
    .innerJoin(questions, eq(solutions.questionId, questions.id))
    .where(
      and(
        eq(solutions.solverId, solverId),
        isNull(solutions.deletedAt),
        sql`${questions.lockedAt} is not null`,
      ),
    );

  const solved = Number(counts?.solved ?? 0);
  const satisfied = Number(counts?.satisfied ?? 0);
  const unsatisfied = Number(counts?.unsatisfied ?? 0);

  return {
    solved,
    satisfied,
    unsatisfied,
    satisfactionRate:
      satisfied + unsatisfied > 0 ? satisfied / (satisfied + unsatisfied) : null,
    avgResponseMinutes: resp?.avgMinutes ? Number(resp.avgMinutes) : null,
  };
}

/**
 * The follow-up-block predicate: a question this solver answered, not yet
 * satisfied, whose latest non-deleted thread message came from the asker —
 * i.e. the ball is in the solver's court.
 */
export function pendingFollowupsWhere(solverId: string) {
  return and(
    eq(questions.solverId, solverId),
    inArray(questions.status, ["answered", "unsatisfied"]),
    isNull(questions.deletedAt),
    sql`(
      select ${threadMessages.authorSide} from ${threadMessages}
      where ${threadMessages.questionId} = ${questions.id}
        and ${threadMessages.deletedAt} is null
      order by ${threadMessages.createdAt} desc
      limit 1
    ) = 'asker'`,
  );
}

export async function listPendingFollowups(db: DB, solverId: string) {
  return db
    .select()
    .from(questions)
    .where(pendingFollowupsWhere(solverId))
    .orderBy(sql`${questions.answeredAt} asc`);
}

export async function countPendingFollowups(
  db: DB,
  solverId: string,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(questions)
    .where(pendingFollowupsWhere(solverId));
  return Number(row?.n ?? 0);
}
