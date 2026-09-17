import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import type { DB } from "../../db";
import {
  askQuotaPolicies,
  auditLog,
  books,
  chapters,
  lockEvents,
  notifications,
  questions,
  threadMessages,
} from "../../db/schema";
import { env } from "../../env";
import { pendingFollowupsWhere } from "../profiles/solver-stats.util";
import type {
  CreateQuestionInput,
  CursorPayload,
  ListQuestionsQuery,
} from "./questions.schema";
import { cursorPayloadSchema } from "./questions.schema";

export type Question = typeof questions.$inferSelect;

// A solver holding this many still-open follow-ups (answered questions whose
// asker replied last and that aren't marked satisfied) can't lock new work
// until they clear the backlog.
export const FOLLOWUP_BLOCK_THRESHOLD = 3;

// Cursors are base64url, not base64: plain base64's `+` and `/` turn into a
// space and a path separator in a hand-built query string, and a mangled
// cursor silently restarts the list from the first page.
function decodeCursor(raw?: string): CursorPayload | null {
  if (!raw) return null;
  try {
    const bytes = Uint8Array.fromBase64(raw, { alphabet: "base64url" });
    const json = JSON.parse(new TextDecoder().decode(bytes));
    const parsed = cursorPayloadSchema.safeParse(json);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function encodeCursor(payload: CursorPayload): string {
  return new TextEncoder()
    .encode(JSON.stringify(payload))
    .toBase64({ alphabet: "base64url", omitPadding: true });
}

export type LockResult =
  | { ok: true; question: Question }
  | { ok: false; reason: "followup_block" }
  | { ok: false; reason: "conflict"; current: Question | null };

export type SimpleResult = { ok: true; question: Question } | { ok: false };

export type OverrideResult =
  | { ok: true; question: Question; previousSolverId: string | null }
  | { ok: false };

export type CreateResult =
  | { ok: true; question: Question }
  | { ok: false; reason: "daily" | "monthly" | "taxonomy" };

export class QuestionsService {
  constructor(private db: DB) {}

  async listQuestionsFeed(query: ListQuestionsQuery, viewerId?: string) {
    const limit = query.limit;
    const decodedCursor = decodeCursor(query.cursor);

    // No status filter means *every* status. Defaulting to "waiting" here
    // silently hid every answered/satisfied question from the list's own
    // "All statuses" view; solvers browsing open work pass ?status=waiting.
    const conditions = [isNull(questions.deletedAt)];
    if (query.status) conditions.push(eq(questions.status, query.status));

    if (query.subject) conditions.push(eq(questions.subjectId, query.subject));
    if (query.book) conditions.push(eq(questions.bookId, query.book));
    if (query.chapter) conditions.push(eq(questions.chapterId, query.chapter));
    if (query.q) conditions.push(ilike(questions.text, `%${query.q}%`));
    if (query.mine && viewerId) conditions.push(eq(questions.askerId, viewerId));

    if (decodedCursor) {
      const cursorDate = new Date(decodedCursor.askedAt);
      // Postgres stores timestamps to microsecond precision, but the cursor
      // round-trips through toISOString(), which only carries milliseconds.
      // So a row written at .577123 is neither `< .577000` nor `= .577000`,
      // and an exact-equality tiebreak drops it: following the cursor
      // returned an empty page and silently lost the record. Compare against
      // the whole millisecond the cursor landed in instead.
      const cursorMsEnd = new Date(cursorDate.getTime() + 1);
      const keyset = or(
        lt(questions.askedAt, cursorDate),
        and(
          gte(questions.askedAt, cursorDate),
          lt(questions.askedAt, cursorMsEnd),
          lt(questions.id, decodedCursor.id),
        ),
      );
      if (keyset) conditions.push(keyset);
    }

    const rows = await this.db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(desc(questions.askedAt), desc(questions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];

    const nextCursor =
      hasMore && last
        ? encodeCursor({ askedAt: last.askedAt.toISOString(), id: last.id })
        : null;

    return { items, nextCursor };
  }

  async getQuestionById(
    id: number,
    opts: { includePrivate: boolean; isStaff: boolean },
  ) {
    const question = await this.db.query.questions.findFirst({
      where: eq(questions.id, id),
      with: {
        asker: { columns: { id: true, name: true, image: true } },
        solver: { columns: { id: true, name: true, image: true } },
        subject: true,
        book: true,
        chapter: true,
        solution: true,
        thread: {
          where: isNull(threadMessages.deletedAt),
          orderBy: [asc(threadMessages.createdAt)],
        },
      },
    });

    if (!question) return null;
    if (question.deletedAt && !opts.isStaff) return null;

    if (!opts.includePrivate) {
      // Guests see the question and its public comments, never the solution
      // or the private follow-up thread.
      const { solution: _solution, thread: _thread, ...rest } = question;
      return rest;
    }

    // A `one()` relation can't be filtered in the query, so a removed
    // solution would otherwise still be returned — text and all.
    const solution =
      question.solution && !question.solution.deletedAt
        ? question.solution
        : null;
    return { ...question, solution };
  }

  async countOpenQuestions(): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(questions)
      .where(and(eq(questions.status, "waiting"), isNull(questions.deletedAt)));
    return row?.value ?? 0;
  }

  private async countAskerQuestionsSince(
    askerId: string,
    since: Date,
  ): Promise<number> {
    const [row] = await this.db
      .select({ value: count() })
      .from(questions)
      .where(
        and(
          eq(questions.askerId, askerId),
          gte(questions.askedAt, since),
          isNull(questions.deletedAt),
        ),
      );
    return row?.value ?? 0;
  }

  async createQuestion(
    askerId: string,
    input: CreateQuestionInput,
  ): Promise<CreateResult> {
    // The three ids arrive independently, and the foreign keys only prove
    // each one exists — not that the chapter belongs to that book, or the
    // book to that subject. A mismatched question would vanish from every
    // correctly filtered list.
    const [placement] = await this.db
      .select({ id: chapters.id })
      .from(chapters)
      .innerJoin(books, eq(books.id, chapters.bookId))
      .where(
        and(
          eq(chapters.id, input.chapterId),
          eq(books.id, input.bookId),
          eq(books.subjectId, input.subjectId),
        ),
      )
      .limit(1);
    if (!placement) return { ok: false, reason: "taxonomy" };

    const policy = await this.db.query.askQuotaPolicies.findFirst({
      where: and(
        eq(askQuotaPolicies.scope, "global"),
        eq(askQuotaPolicies.active, true),
      ),
    });

    if (policy?.maxPerDay != null) {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const dayCount = await this.countAskerQuestionsSince(askerId, startOfDay);
      if (dayCount >= policy.maxPerDay) return { ok: false, reason: "daily" };
    }

    if (policy?.maxPerMonth != null) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthCount = await this.countAskerQuestionsSince(
        askerId,
        startOfMonth,
      );
      if (monthCount >= policy.maxPerMonth) {
        return { ok: false, reason: "monthly" };
      }
    }

    const [created] = await this.db
      .insert(questions)
      .values({
        askerId,
        subjectId: input.subjectId,
        bookId: input.bookId,
        chapterId: input.chapterId,
        text: input.text,
        photoUrl: input.photoUrl ?? null,
        status: "waiting",
      })
      .returning();

    if (!created) throw new Error("Failed to persist question");
    return { ok: true, question: created };
  }

  async lockQuestion(questionId: number, solverId: string): Promise<LockResult> {
    return this.db.transaction(async (tx) => {
      // Serializes concurrent lock attempts *by this solver* for the duration
      // of the transaction, so the follow-up-block check below can't be
      // raced. Keyed on the solver, so it never blocks a different solver —
      // the contention that matters (two solvers racing for one question) is
      // still resolved by the atomic UPDATE, not by this lock.
      // (A plain count inside the transaction would not be enough on its own:
      // under READ COMMITTED it doesn't block a concurrent writer.)
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${solverId}))`);

      // The same predicate the dashboard lists, so "blocked" and "what's
      // blocking you" can never disagree.
      const [blocking] = await tx
        .select({ n: count() })
        .from(questions)
        .where(pendingFollowupsWhere(solverId));
      if ((blocking?.n ?? 0) >= FOLLOWUP_BLOCK_THRESHOLD) {
        return { ok: false, reason: "followup_block" };
      }

      const reclaimable = or(
        eq(questions.status, "waiting"),
        and(
          eq(questions.status, "assigned"),
          lt(questions.lockExpiresAt, sql`now()`),
        ),
      );

      const [claimed] = await tx
        .update(questions)
        .set({
          status: "assigned",
          solverId,
          lockedAt: sql`now()`,
          lockExpiresAt: sql`now() + (${env.LOCK_TIMEOUT_MINUTES} * interval '1 minute')`,
          matchedAfterSec: sql`extract(epoch from (now() - ${questions.askedAt}))::int`,
        })
        .where(
          and(
            eq(questions.id, questionId),
            isNull(questions.deletedAt),
            reclaimable,
          ),
        )
        .returning();

      if (!claimed) {
        const current = await tx.query.questions.findFirst({
          where: eq(questions.id, questionId),
        });
        return { ok: false, reason: "conflict", current: current ?? null };
      }

      await tx
        .insert(lockEvents)
        .values({ questionId: claimed.id, solverId, action: "lock" });
      await tx.insert(notifications).values({
        userId: claimed.askerId,
        type: "assigned",
        questionId: claimed.id,
        actorId: solverId,
      });

      return { ok: true, question: claimed };
    });
  }

  async unlockQuestion(
    questionId: number,
    solverId: string,
  ): Promise<SimpleResult> {
    return this.db.transaction(async (tx) => {
      const [released] = await tx
        .update(questions)
        .set({
          status: "waiting",
          solverId: null,
          lockedAt: null,
          lockExpiresAt: null,
          matchedAfterSec: null,
        })
        .where(
          and(
            eq(questions.id, questionId),
            eq(questions.solverId, solverId),
            eq(questions.status, "assigned"),
            isNull(questions.deletedAt),
          ),
        )
        .returning();

      if (!released) return { ok: false };

      // The follow-up thread belonged to the abandoned attempt — the
      // prototype clears it outright rather than soft-deleting.
      await tx
        .delete(threadMessages)
        .where(eq(threadMessages.questionId, questionId));
      await tx
        .insert(lockEvents)
        .values({ questionId, solverId, action: "unlock" });
      await tx.insert(notifications).values({
        userId: released.askerId,
        type: "released",
        questionId: released.id,
        actorId: solverId,
      });

      return { ok: true, question: released };
    });
  }

  async overrideQuestion(
    questionId: number,
    newSolverId: string,
  ): Promise<OverrideResult> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.questions.findFirst({
        where: eq(questions.id, questionId),
      });
      const previousSolverId = existing?.solverId ?? null;

      const [updated] = await tx
        .update(questions)
        .set({
          solverId: newSolverId,
          lockedAt: sql`now()`,
          lockExpiresAt: sql`now() + (${env.LOCK_TIMEOUT_MINUTES} * interval '1 minute')`,
        })
        .where(
          and(
            eq(questions.id, questionId),
            eq(questions.status, "assigned"),
            isNull(questions.deletedAt),
          ),
        )
        .returning();

      if (!updated) return { ok: false };

      await tx.insert(lockEvents).values({
        questionId: updated.id,
        solverId: newSolverId,
        action: "override",
      });

      if (previousSolverId && previousSolverId !== newSolverId) {
        await tx.insert(notifications).values({
          userId: previousSolverId,
          type: "override",
          questionId: updated.id,
          actorId: newSolverId,
        });
      }

      await tx.insert(notifications).values({
        userId: updated.askerId,
        type: "assigned",
        questionId: updated.id,
        actorId: newSolverId,
      });

      return { ok: true, question: updated, previousSolverId };
    });
  }

  async softDeleteQuestion(
    questionId: number,
    actorId: string,
  ): Promise<SimpleResult> {
    return this.db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(questions)
        .set({ deletedAt: sql`now()`, deletedBy: actorId })
        .where(and(eq(questions.id, questionId), isNull(questions.deletedAt)))
        .returning();

      if (!deleted) return { ok: false };

      await tx.insert(auditLog).values({
        actorId,
        action: "delete_question",
        entityType: "question",
        entityId: String(questionId),
      });

      return { ok: true, question: deleted };
    });
  }
}
