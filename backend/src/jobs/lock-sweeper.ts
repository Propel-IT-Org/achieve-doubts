import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { DB } from "../db";
import { lockEvents, notifications, questions } from "../db/schema";
import type { FeedHub } from "../ws/hub";

/**
 * Arbitrary constant identifying the sweep lock. Advisory locks share one
 * global key space, so this must not collide with another advisory lock —
 * questions.service.ts keys its per-solver lock on hashtext(solverId).
 */
const SWEEP_LOCK_KEY = 4_820_119;

/**
 * Returns expired locks to the open feed.
 *
 * Without this, an abandoned lock is invisible: the question stays
 * `assigned` (so it never appears in the `waiting` feed) while the lock
 * predicate treats it as reclaimable — meaning nobody can find the question
 * they are allowed to take.
 *
 * With several replicas every instance runs this timer. Concurrent sweeps are
 * not incorrect — the UPDATE is atomic, so a given row is returned to exactly
 * one instance — but they are wasted work, so only one instance sweeps per
 * tick and the rest return immediately.
 *
 * The lock is TRANSACTION-scoped on purpose. The database client is a
 * connection pool, so a session-level lock and its unlock can land on
 * different connections: the unlock silently fails, the lock stays held by an
 * idle pooled connection, and no instance ever sweeps again. An xact lock is
 * taken and released on the one connection the transaction owns.
 */
export async function sweepExpiredLocks(db: DB, feed?: FeedHub) {
  const expiredIds = await db.transaction(async (tx) => {
    const lockRows = (await tx.execute(
      sql`select pg_try_advisory_xact_lock(${SWEEP_LOCK_KEY}) as ok`,
    )) as unknown as Array<{ ok: boolean }>;

    if (!lockRows[0]?.ok) return [];
    return runSweep(tx as unknown as DB);
  });

  // Broadcast only after COMMIT. Announcing from inside the transaction would
  // let a client refetch before the change is visible and see the old state.
  for (const questionId of expiredIds) {
    feed?.broadcast("QUESTION_EXPIRED", { questionId });
  }

  return expiredIds.length;
}

async function runSweep(db: DB): Promise<number[]> {
  const expired = await db
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
        eq(questions.status, "assigned"),
        isNull(questions.deletedAt),
        lt(questions.lockExpiresAt, sql`now()`),
      ),
    )
    .returning({ id: questions.id, askerId: questions.askerId });

  for (const row of expired) {
    // `returning()` gives the post-update row, so solverId is already null —
    // the previous holder is recovered from the most recent lock event.
    // "override" counts: a taken-over question's current holder is whoever
    // overrode it, so matching only "lock" would credit the expiry to the
    // original locker instead.
    const [lastLock] = await db
      .select({ solverId: lockEvents.solverId })
      .from(lockEvents)
      .where(
        and(
          eq(lockEvents.questionId, row.id),
          inArray(lockEvents.action, ["lock", "override"]),
        ),
      )
      .orderBy(sql`${lockEvents.at} desc`)
      .limit(1);

    if (lastLock) {
      await db.insert(lockEvents).values({
        questionId: row.id,
        solverId: lastLock.solverId,
        action: "expire",
      });
    }

    await db.insert(notifications).values({
      userId: row.askerId,
      type: "released",
      questionId: row.id,
    });
  }

  return expired.map((row) => row.id);
}

/**
 * Starts the periodic sweep. Returns a stop function so tests (and a
 * graceful shutdown) can clear the timer.
 */
export function startLockSweeper(
  db: DB,
  feed?: FeedHub,
  intervalMs = 30_000,
): () => void {
  const timer = setInterval(() => {
    sweepExpiredLocks(db, feed).catch((err) => {
      console.error("[lock-sweeper] sweep failed", err);
    });
  }, intervalMs);

  // Don't hold the process open purely for the sweeper.
  timer.unref?.();

  return () => clearInterval(timer);
}
