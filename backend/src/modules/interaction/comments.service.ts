import { and, asc, eq } from "drizzle-orm";
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

  async listComments(questionId: number) {
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
    if (!question) return { error: "not_found" as const };

    const [row] = await this.db
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
      await this.db.insert(notifications).values(notifRows);
    }

    return { comment: shapeSoftDeletable(row) };
  }

  async deleteComment(questionId: number, commentId: number, actorId: string) {
    const [row] = await this.db
      .update(comments)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(
        and(eq(comments.id, commentId), eq(comments.questionId, questionId)),
      )
      .returning();

    return row ? shapeSoftDeletable(row) : null;
  }
}
