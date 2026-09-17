import { and, asc, eq, isNull } from "drizzle-orm";
import type { DB } from "../../db";
import { comments, notifications, questions } from "../../db/schema";
import type { CreateCommentInput } from "./comments.schema";
import { shapeSoftDeletable } from "./shared";

const ANSWERED_STATUSES = ["answered", "satisfied", "unsatisfied"] as const;

export type CreateCommentResult =
  | { error: "not_found" }
  | { comment: ReturnType<typeof shapeSoftDeletable> };

export class CommentsService {
  constructor(private db: DB) {}

  /** Null when the question doesn't exist or was removed. */
  async listComments(questionId: number) {
    const [question] = await this.db
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)));
    if (!question) return null;

    const rows = await this.db
      .select()
      .from(comments)
      .where(eq(comments.questionId, questionId))
      .orderBy(asc(comments.createdAt));

    return rows.map(shapeSoftDeletable);
  }

  /**
   * Notification rule: notify the asker unless the commenter IS the asker,
   * and independently notify the assigned solver but only once the question
   * has been answered. A comment therefore fires 0, 1 or 2 notifications.
   */
  async createComment(
    questionId: number,
    authorId: string,
    input: CreateCommentInput,
  ): Promise<CreateCommentResult> {
    const [question] = await this.db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));
    if (!question || question.deletedAt) return { error: "not_found" as const };

    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(comments)
        .values({
          questionId,
          authorId,
          text: input.text,
          imageUrl: input.imageUrl,
          audioUrl: input.audioUrl,
          audioSeconds: input.audioSeconds,
        })
        .returning();

      if (!row) throw new Error("Failed to persist comment");

      const notifRows: (typeof notifications.$inferInsert)[] = [];
      if (question.askerId !== authorId) {
        notifRows.push({
          type: "comment",
          userId: question.askerId,
          questionId,
          actorId: authorId,
        });
      }
      if (
        question.solverId &&
        ANSWERED_STATUSES.includes(
          question.status as (typeof ANSWERED_STATUSES)[number],
        )
      ) {
        notifRows.push({
          type: "comment",
          userId: question.solverId,
          questionId,
          actorId: authorId,
        });
      }
      if (notifRows.length > 0) {
        await tx.insert(notifications).values(notifRows);
      }

      return { comment: shapeSoftDeletable(row) };
    });
  }

  async deleteComment(questionId: number, commentId: number, actorId: string) {
    const [row] = await this.db
      .update(comments)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.questionId, questionId),
          isNull(comments.deletedAt),
        ),
      )
      .returning();

    return row ? shapeSoftDeletable(row) : null;
  }
}
