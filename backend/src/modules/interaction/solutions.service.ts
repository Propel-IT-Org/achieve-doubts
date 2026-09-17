import { and, eq, isNull, sql } from "drizzle-orm";
import type { DB } from "../../db";
import {
  auditLog,
  notifications,
  questions,
  solutions,
  threadMessages,
} from "../../db/schema";
import { env } from "../../env";
import type { CreateSolutionInput } from "./solutions.schema";

export type SubmitSolutionResult =
  | { error: "lock" | "duplicate" }
  | {
      solution: typeof solutions.$inferSelect;
      question: typeof questions.$inferSelect;
    };

export type DeleteSolutionResult =
  | { error: "not_found" | "forbidden" }
  | { question: typeof questions.$inferSelect };

export type RateQuestionResult =
  | { error: "not_found" | "forbidden" | "not_answered" }
  | { question: typeof questions.$inferSelect };

const ANSWERED_STATUSES = ["answered", "satisfied", "unsatisfied"] as const;

export class SolutionsService {
  constructor(private db: DB) {}

  /**
   * One transaction: move the question to `answered`, write the solution,
   * notify the asker.
   *
   * The lock check IS the status UPDATE — `where status = 'assigned' and
   * solver_id = caller`. A read-then-write would let an unlock, an override or
   * the expiry sweeper slip in between the check and the write, and answer a
   * question the caller no longer holds.
   *
   * Early returns happen before any write, because returning from a drizzle
   * transaction callback commits whatever it already did.
   */
  async submitSolution(
    solverId: string,
    questionId: number,
    input: CreateSolutionInput,
  ): Promise<SubmitSolutionResult> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: solutions.id, deletedAt: solutions.deletedAt })
        .from(solutions)
        .where(eq(solutions.questionId, questionId));

      if (existing && !existing.deletedAt) {
        return { error: "duplicate" as const };
      }

      const [question] = await tx
        .update(questions)
        .set({ status: "answered", answeredAt: sql`now()` })
        .where(
          and(
            eq(questions.id, questionId),
            eq(questions.status, "assigned"),
            eq(questions.solverId, solverId),
            isNull(questions.deletedAt),
          ),
        )
        .returning();

      if (!question) return { error: "lock" as const };

      // UNIQUE(question_id) still counts a soft-deleted solution, so without
      // this a solver could never submit again after their solution was
      // removed. The removal itself is preserved in the audit log.
      if (existing) {
        await tx.delete(solutions).where(eq(solutions.id, existing.id));
      }

      const [solution] = await tx
        .insert(solutions)
        .values({
          questionId,
          solverId,
          text: input.text,
          imageUrl: input.imageUrl,
          audioUrl: input.audioUrl,
          audioSeconds: input.audioSeconds,
        })
        .returning();

      if (!solution) throw new Error("Failed to persist solution");

      await tx.insert(notifications).values({
        type: "solved",
        userId: question.askerId,
        questionId,
        actorId: solverId,
      });

      return { solution, question };
    });
  }

  /**
   * Soft-deletes the solution, reverts the question to `assigned` with the
   * same solver, clears the rating, and hard-deletes the follow-up thread so
   * the solver can submit a fresh solution or unlock.
   *
   * `canDeleteAny` comes from the caller's role; an ordinary solver may only
   * delete their own.
   */
  async deleteSolution(
    questionId: number,
    actorId: string,
    canDeleteAny: boolean,
  ): Promise<DeleteSolutionResult> {
    return this.db.transaction(async (tx) => {
      const [solution] = await tx
        .select()
        .from(solutions)
        .where(eq(solutions.questionId, questionId));

      if (!solution || solution.deletedAt) {
        return { error: "not_found" as const };
      }

      if (!canDeleteAny && solution.solverId !== actorId) {
        return { error: "forbidden" as const };
      }

      await tx
        .update(solutions)
        .set({ deletedAt: new Date(), deletedBy: actorId })
        .where(eq(solutions.id, solution.id));

      const [question] = await tx
        .update(questions)
        .set({
          status: "assigned",
          ratedAt: null,
          answeredAt: null,
          // Restart the lock clock. The old expiry is usually long past by
          // now, and keeping it would let the sweeper reclaim the question
          // within seconds — taking it from the solver meant to redo it.
          lockedAt: sql`now()`,
          lockExpiresAt: sql`now() + (${env.LOCK_TIMEOUT_MINUTES} * interval '1 minute')`,
        })
        .where(eq(questions.id, questionId))
        .returning();

      if (!question) {
        throw new Error("Failed to revert question after deleting solution");
      }

      await tx
        .delete(threadMessages)
        .where(eq(threadMessages.questionId, questionId));

      // A later resubmission hard-deletes this row, so the audit entry is the
      // lasting record of what was removed and by whom.
      await tx.insert(auditLog).values({
        actorId,
        action: "solution.delete",
        entityType: "solution",
        entityId: String(solution.id),
        meta: {
          questionId,
          solverId: solution.solverId,
          text: solution.text?.slice(0, 500) ?? null,
          imageUrl: solution.imageUrl,
          audioUrl: solution.audioUrl,
        },
      });

      return { question };
    });
  }

  /** Changeable — re-rating just flips the status again. */
  async rateQuestion(
    questionId: number,
    askerId: string,
    value: "satisfied" | "unsatisfied",
  ): Promise<RateQuestionResult> {
    const [question] = await this.db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!question || question.deletedAt) return { error: "not_found" as const };
    if (question.askerId !== askerId) return { error: "forbidden" as const };
    if (
      !ANSWERED_STATUSES.includes(
        question.status as (typeof ANSWERED_STATUSES)[number],
      )
    ) {
      return { error: "not_answered" as const };
    }

    // Conditional, like the lock: if the solution was deleted between the
    // read above and this write, the question is no longer answered.
    const [updated] = await this.db
      .update(questions)
      .set({ status: value, ratedAt: new Date() })
      .where(
        and(
          eq(questions.id, questionId),
          sql`${questions.status} in ('answered','satisfied','unsatisfied')`,
        ),
      )
      .returning();

    if (!updated) return { error: "not_answered" as const };
    return { question: updated };
  }
}
