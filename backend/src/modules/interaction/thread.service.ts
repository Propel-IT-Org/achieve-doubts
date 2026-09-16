import { and, asc, eq, isNull } from "drizzle-orm";
import type { DB } from "../../db";
import {
  notifications,
  questions,
  solutions,
  threadMessages,
} from "../../db/schema";
import { shapeSoftDeletable } from "./shared";
import type { CreateThreadMessageInput } from "./thread.schema";

export class ThreadService {
  constructor(private db: DB) {}

  async getQuestion(questionId: number) {
    const [question] = await this.db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));
    return question ?? null;
  }

  /** An active (non-deleted) solution gates read and write access. */
  async hasActiveSolution(questionId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ id: solutions.id })
      .from(solutions)
      .where(
        and(eq(solutions.questionId, questionId), isNull(solutions.deletedAt)),
      );
    return Boolean(row);
  }

  async listThread(questionId: number) {
    const rows = await this.db
      .select()
      .from(threadMessages)
      .where(eq(threadMessages.questionId, questionId))
      .orderBy(asc(threadMessages.createdAt));

    return rows.map(shapeSoftDeletable);
  }

  /**
   * Notification rule: the asker's follow-ups notify the assigned solver
   * (`followup`); a solver replying notifies nobody — the prototype has no
   * "reply" notification type.
   */
  async postMessage(
    questionId: number,
    authorId: string,
    authorSide: "asker" | "solver",
    input: CreateThreadMessageInput,
    notifyUserId: string | null,
  ) {
    const [message] = await this.db
      .insert(threadMessages)
      .values({
        questionId,
        authorId,
        authorSide,
        text: input.text,
        imageUrl: input.imageUrl,
        audioUrl: input.audioUrl,
        audioSeconds: input.audioSeconds,
      })
      .returning();

    if (!message) throw new Error("Failed to persist thread message");

    if (notifyUserId) {
      await this.db.insert(notifications).values({
        type: "followup",
        userId: notifyUserId,
        questionId,
        actorId: authorId,
      });
    }

    return shapeSoftDeletable(message);
  }

  async deleteMessage(questionId: number, messageId: number, actorId: string) {
    const [row] = await this.db
      .update(threadMessages)
      .set({ deletedAt: new Date(), deletedBy: actorId })
      .where(
        and(
          eq(threadMessages.id, messageId),
          eq(threadMessages.questionId, questionId),
        ),
      )
      .returning();

    return row ? shapeSoftDeletable(row) : null;
  }
}
