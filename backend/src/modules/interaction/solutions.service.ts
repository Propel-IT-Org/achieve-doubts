import { eq } from "drizzle-orm";
import type { DB } from "../../db";
import {
  notifications,
  questions,
  solutions,
  threadMessages,
} from "../../db/schema";
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
   * One transaction: verify the caller still holds the lock, insert the
   * solution, mark the question answered, notify the asker. The friendly
   * duplicate check is a SELECT — the UNIQUE(question_id) constraint is the
   * real enforcement, this just avoids surfacing a raw constraint violation.
   */
  async submitSolution(
    solverId: string,
    questionId: number,
    input: CreateSolutionInput,
  ): Promise<SubmitSolutionResult> {
    return this.db.transaction(async (tx) => {
      const [question] = await tx
        .select()
        .from(questions)
        .where(eq(questions.id, questionId));

      if (
        !question ||
        question.status !== "assigned" ||
        question.solverId !== solverId
      ) {
        return { error: "lock" as const };
      }

      const [existing] = await tx
        .select({ id: solutions.id })
        .from(solutions)
        .where(eq(solutions.questionId, questionId));

      if (existing) return { error: "duplicate" as const };

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

      const [updatedQuestion] = await tx
        .update(questions)
        .set({ status: "answered", answeredAt: new Date() })
        .where(eq(questions.id, questionId))
        .returning();

      await tx.insert(notifications).values({
        type: "solved",
        userId: question.askerId,
        questionId,
        actorId: solverId,
      });

      if (!solution || !updatedQuestion) {
        throw new Error("Failed to persist solution");
      }

      return { solution, question: updatedQuestion };
    });
  }

  /**
   * Soft-deletes the solution, reverts the question to `assigned` (the lock
   * itself is untouched — deleting a solution doesn't release the solver),
   * clears the rating, and hard-deletes the follow-up thread so the solver
   * can submit a fresh solution or unlock.
   *
   * `canDeleteAny` comes from the caller's `solution: ["delete"]` permission
   * plus an ownership check in the router — an ordinary solver may only
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

      if (!solution || solution.deletedAt) return { error: "not_found" as const };

      if (!canDeleteAny && solution.solverId !== actorId) {
        return { error: "forbidden" as const };
      }

      await tx
        .update(solutions)
        .set({ deletedAt: new Date(), deletedBy: actorId })
        .where(eq(solutions.id, solution.id));

      const [question] = await tx
        .update(questions)
        .set({ status: "assigned", ratedAt: null, answeredAt: null })
        .where(eq(questions.id, questionId))
        .returning();

      await tx
        .delete(threadMessages)
        .where(eq(threadMessages.questionId, questionId));

      if (!question) {
        throw new Error("Failed to revert question after deleting solution");
      }

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

    if (!question) return { error: "not_found" as const };
    if (question.askerId !== askerId) return { error: "forbidden" as const };
    if (
      !ANSWERED_STATUSES.includes(
        question.status as (typeof ANSWERED_STATUSES)[number],
      )
    ) {
      return { error: "not_answered" as const };
    }

    const [updated] = await this.db
      .update(questions)
      .set({ status: value, ratedAt: new Date() })
      .where(eq(questions.id, questionId))
      .returning();

    if (!updated) throw new Error("Failed to persist rating");
    return { question: updated };
  }
}
