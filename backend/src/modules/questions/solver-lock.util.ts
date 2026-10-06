import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { DB } from "../../db";
import { questions } from "../../db/schema";

/**
 * One question at a time per solver.
 *
 * Every path that can leave a solver holding a question — locking one,
 * an admin solver taking one over, a solver deleting their own solution
 * (which hands the question back to them) — runs the same two steps in its
 * transaction: serializeSolver, then heldLock. Serializing on the solver is
 * what makes the check safe: two lock requests from the same solver (two
 * tabs, a double tap) queue on the advisory lock, and the second one sees
 * the first one's lock once it commits. A plain count under READ COMMITTED
 * would let both through.
 */

/** A transaction handle, as `db.transaction` passes it to its callback. */
type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

/** Holds this solver's lock-taking paths to one at a time until the transaction ends. */
export async function serializeSolver(tx: Tx, solverId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${solverId}))`);
}

/**
 * The question this solver currently holds, if any, other than `exceptId`.
 *
 * A lock past its expiry still counts until the sweeper releases it (it runs
 * every 30 seconds): until then the solver can still submit to it, so it is
 * still theirs.
 */
export async function heldLock(tx: Tx, solverId: string, exceptId: number) {
  const [row] = await tx
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.solverId, solverId),
        eq(questions.status, "assigned"),
        isNull(questions.deletedAt),
        ne(questions.id, exceptId),
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

/** What a solver is told when they already hold a question. */
export const lockLimitMessage = (heldId: number) =>
  `You're already working on question #${heldId}. Answer or unlock it before taking another.`;
