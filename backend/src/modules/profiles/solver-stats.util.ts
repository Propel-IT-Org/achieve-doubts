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
 * How many unanswered follow-ups a solver may hold and still lock new
 * questions: above this, locking pauses until they reply.
 */
export const FOLLOWUP_LIMIT = 3;

/** Whether a solver holding `pending` unanswered follow-ups can't lock. */
export const isLockBlocked = (pending: number) => pending > FOLLOWUP_LIMIT;

/**
 * An unanswered follow-up: a question with a solution (answered, whatever
 * its rating) whose latest non-deleted thread message came from the asker.
 * The student's follow-up puts it on the solver's count; the solver's reply
 * takes it off again. A satisfied rating doesn't clear it — a follow-up
 * posted after rating "satisfied" still needs an answer.
 */
export function pendingFollowupCondition() {
  return and(
    inArray(questions.status, ["answered", "satisfied", "unsatisfied"]),
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

export function pendingFollowupsWhere(solverId: string) {
  return and(eq(questions.solverId, solverId), pendingFollowupCondition());
}

export async function listPendingFollowups(db: DB, solverId: string) {
  return db
    .select()
    .from(questions)
    .where(pendingFollowupsWhere(solverId))
    .orderBy(sql`${questions.answeredAt} asc`);
}
