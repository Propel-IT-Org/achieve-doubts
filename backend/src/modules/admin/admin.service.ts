import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from "drizzle-orm";
import type { DB } from "../../db";
import {
  askQuotaPolicies,
  auditLog,
  batches,
  payoutLines,
  payoutPeriods,
  questions,
  solutions,
  solverProfiles,
  studentProfiles,
  user,
} from "../../db/schema";
import type { Auth } from "../../lib/auth";
import { countPendingFollowups } from "../profiles/solver-stats.util";
import type { CreateSolverInput, QuotaInput, RangeQuery } from "./admin.schema";

/** Everything the staff admin panel does. */
export class AdminService {
  constructor(
    private db: DB,
    private auth: Auth,
  ) {}

  private async audit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    meta?: Record<string, unknown>,
  ) {
    await this.db
      .insert(auditLog)
      .values({ actorId, action, entityType, entityId, meta: meta ?? null });
  }

  // ---------- students ----------

  async listStudents(q: string | undefined, limit: number, offset: number) {
    const search = q?.trim();
    const filters = [eq(user.role, "student")];
    if (search) {
      const like = `%${search}%`;
      const match = or(
        ilike(user.name, like),
        ilike(user.email, like),
        ilike(studentProfiles.college, like),
        ilike(studentProfiles.district, like),
      );
      if (match) filters.push(match);
    }

    return this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        banned: user.banned,
        joinedAt: user.createdAt,
        college: studentProfiles.college,
        district: studentProfiles.district,
        hscYear: studentProfiles.hscYear,
        phone: studentProfiles.phone,
        batchId: studentProfiles.batchId,
      })
      .from(user)
      .leftJoin(studentProfiles, eq(studentProfiles.userId, user.id))
      .where(and(...filters))
      .orderBy(desc(user.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getStudent(id: string) {
    const [row] = await this.db
      .select()
      .from(user)
      .leftJoin(studentProfiles, eq(studentProfiles.userId, user.id))
      .where(and(eq(user.id, id), eq(user.role, "student")));

    if (!row) return null;

    const [stats] = await this.db
      .select({
        asked: sql<number>`count(*)`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
      })
      .from(questions)
      .where(and(eq(questions.askerId, id), isNull(questions.deletedAt)));

    return { ...row, stats };
  }

  /**
   * Deactivation goes through better-auth's ban API rather than a local
   * flag, so existing sessions are revoked and future sign-ins are refused
   * by the framework itself.
   */
  async setUserActive(
    userId: string,
    active: boolean,
    headers: Headers,
    actorId: string,
    reason = "Deactivated by an administrator",
  ) {
    if (active) {
      await this.auth.api.unbanUser({ body: { userId }, headers });
    } else {
      await this.auth.api.banUser({
        body: { userId, banReason: reason },
        headers,
      });
    }
    await this.audit(
      actorId,
      active ? "user.reactivate" : "user.deactivate",
      "user",
      userId,
      { reason },
    );
  }

  // ---------- solvers ----------

  async listSolvers() {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        banned: user.banned,
        phone: solverProfiles.phone,
        institution: solverProfiles.institution,
        dept: solverProfiles.dept,
        batch: solverProfiles.batch,
      })
      .from(user)
      .leftJoin(solverProfiles, eq(solverProfiles.userId, user.id))
      .where(sql`${user.role} in ('solver','adminSolver')`)
      .orderBy(desc(user.createdAt));

    return Promise.all(
      rows.map(async (row) => {
        const [agg] = await this.db
          .select({
            solved: sql<number>`count(*) filter (where ${questions.status} in ('answered','satisfied','unsatisfied'))`,
            satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
            unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
          })
          .from(questions)
          .where(
            and(eq(questions.solverId, row.id), isNull(questions.deletedAt)),
          );

        const satisfied = Number(agg?.satisfied ?? 0);
        const unsatisfied = Number(agg?.unsatisfied ?? 0);

        return {
          ...row,
          isAdminSolver: row.role === "adminSolver",
          solved: Number(agg?.solved ?? 0),
          satisfactionRate:
            satisfied + unsatisfied > 0
              ? satisfied / (satisfied + unsatisfied)
              : null,
          pendingFollowups: await countPendingFollowups(this.db, row.id),
        };
      }),
    );
  }

  async createSolver(
    input: CreateSolverInput,
    headers: Headers,
    actorId: string,
  ) {
    const [emailTaken] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email));
    if (emailTaken) return { error: "That email is already in use" as const };

    const [usernameTaken] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.username, input.username));
    if (usernameTaken) {
      return { error: "That username is already in use" as const };
    }

    if (input.phone) {
      const [phoneTaken] = await this.db
        .select({ userId: solverProfiles.userId })
        .from(solverProfiles)
        .where(eq(solverProfiles.phone, input.phone));
      if (phoneTaken) {
        return { error: "That phone number is already in use" as const };
      }
    }

    const created = await this.auth.api.createUser({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
        role: "solver",
        data: { username: input.username, displayUsername: input.username },
      },
      headers,
    });

    const newUserId = created.user.id;

    await this.db.insert(solverProfiles).values({
      userId: newUserId,
      phone: input.phone,
      institution: input.institution,
      dept: input.dept,
      batch: input.batch,
    });

    await this.audit(actorId, "solver.create", "user", newUserId);

    return { solver: created.user };
  }

  /**
   * Admin-solver elevation is a role change, not a profile flag: the whole
   * authorization system keys off `user.role`, so this is the single switch.
   */
  async setSolverAdmin(
    userId: string,
    isAdminSolver: boolean,
    headers: Headers,
    actorId: string,
  ) {
    await this.auth.api.setRole({
      body: { userId, role: isAdminSolver ? "adminSolver" : "solver" },
      headers,
    });
    await this.audit(
      actorId,
      isAdminSolver ? "solver.grant_admin" : "solver.revoke_admin",
      "user",
      userId,
    );
  }

  // ---------- batches ----------

  async listBatches() {
    return this.db.select().from(batches).orderBy(desc(batches.createdAt));
  }

  async createBatch(id: string, label: string, actorId: string) {
    const [existing] = await this.db
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, id));
    if (existing) return { error: "That batch already exists" as const };

    const [row] = await this.db
      .insert(batches)
      .values({ id, label, active: true, createdAt: new Date() })
      .returning();

    await this.audit(actorId, "batch.create", "batch", id);
    return { batch: row };
  }

  /**
   * A batch is a course cohort. Deactivating one removes access for every
   * student enrolled in it — each of those accounts is banned through
   * better-auth, which revokes their live sessions too. Reactivating the
   * batch lifts the ban again.
   *
   * This is also why the SSO handshake rejects an unknown or inactive batch:
   * a student whose cohort isn't registered can never get in.
   */
  async setBatchActive(
    batchId: string,
    active: boolean,
    headers: Headers,
    actorId: string,
  ) {
    const [batch] = await this.db
      .update(batches)
      .set({ active })
      .where(eq(batches.id, batchId))
      .returning();

    if (!batch) return { error: "Batch not found" as const };

    const members = await this.db
      .select({ userId: studentProfiles.userId })
      .from(studentProfiles)
      .where(eq(studentProfiles.batchId, batchId));

    const reason = `Batch ${batchId} deactivated`;
    for (const member of members) {
      try {
        if (active) {
          await this.auth.api.unbanUser({
            body: { userId: member.userId },
            headers,
          });
        } else {
          await this.auth.api.banUser({
            body: { userId: member.userId, banReason: reason },
            headers,
          });
        }
      } catch (err) {
        // One failure shouldn't abort the rest of the cohort.
        console.error(
          `[admin] failed to ${active ? "unban" : "ban"} ${member.userId}`,
          err,
        );
      }
    }

    await this.audit(
      actorId,
      active ? "batch.activate" : "batch.deactivate",
      "batch",
      batchId,
      { affectedStudents: members.length },
    );

    return { batch, affectedStudents: members.length };
  }

  // ---------- quota ----------

  async getQuota() {
    const row = await this.db.query.askQuotaPolicies.findFirst({
      where: eq(askQuotaPolicies.scope, "global"),
    });
    return row ?? { scope: "global", maxPerDay: null, maxPerMonth: null, active: true };
  }

  async setQuota(input: QuotaInput, actorId: string) {
    const existing = await this.db.query.askQuotaPolicies.findFirst({
      where: eq(askQuotaPolicies.scope, "global"),
    });

    const [row] = existing
      ? await this.db
          .update(askQuotaPolicies)
          .set({ maxPerDay: input.maxPerDay, maxPerMonth: input.maxPerMonth })
          .where(eq(askQuotaPolicies.id, existing.id))
          .returning()
      : await this.db
          .insert(askQuotaPolicies)
          .values({
            scope: "global",
            maxPerDay: input.maxPerDay,
            maxPerMonth: input.maxPerMonth,
            active: true,
          })
          .returning();

    await this.audit(actorId, "quota.update", "ask_quota_policy", "global", {
      maxPerDay: input.maxPerDay,
      maxPerMonth: input.maxPerMonth,
    });

    return row;
  }

  // ---------- analytics ----------

  private rangeFilters(query: RangeQuery) {
    const filters = [isNull(questions.deletedAt)];
    if (query.from) filters.push(gte(questions.askedAt, new Date(query.from)));
    if (query.to) filters.push(lte(questions.askedAt, new Date(query.to)));
    if (query.subject) filters.push(eq(questions.subjectId, query.subject));
    if (query.solver) filters.push(eq(questions.solverId, query.solver));
    return filters;
  }

  async analytics(query: RangeQuery) {
    const filters = this.rangeFilters(query);

    const perSubject = await this.db
      .select({
        subjectId: questions.subjectId,
        total: sql<number>`count(*)`,
      })
      .from(questions)
      .where(and(...filters))
      .groupBy(questions.subjectId);

    const [totals] = await this.db
      .select({
        total: sql<number>`count(*)`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
        unrated: sql<number>`count(*) filter (where ${questions.status} = 'answered')`,
        avgMatchSec: sql<string | null>`avg(${questions.matchedAfterSec})`,
      })
      .from(questions)
      .where(and(...filters));

    const trend = await this.db
      .select({
        day: sql<string>`date_trunc('day', ${questions.answeredAt})::date`,
        total: sql<number>`count(*)`,
      })
      .from(questions)
      .where(and(...filters, sql`${questions.answeredAt} is not null`))
      .groupBy(sql`date_trunc('day', ${questions.answeredAt})`)
      .orderBy(sql`date_trunc('day', ${questions.answeredAt})`);

    const [resp] = await this.db
      .select({
        avgMinutes: sql<
          string | null
        >`avg(extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)`,
      })
      .from(solutions)
      .innerJoin(questions, eq(solutions.questionId, questions.id))
      .where(and(...filters, isNull(solutions.deletedAt)));

    return {
      perSubject: perSubject.map((r) => ({
        subjectId: r.subjectId,
        total: Number(r.total),
      })),
      satisfaction: {
        satisfied: Number(totals?.satisfied ?? 0),
        unsatisfied: Number(totals?.unsatisfied ?? 0),
        unrated: Number(totals?.unrated ?? 0),
      },
      total: Number(totals?.total ?? 0),
      avgMatchSeconds: totals?.avgMatchSec ? Number(totals.avgMatchSec) : null,
      avgResponseMinutes: resp?.avgMinutes ? Number(resp.avgMinutes) : null,
      trend: trend.map((r) => ({ day: r.day, total: Number(r.total) })),
    };
  }

  async rankings(query: RangeQuery, minAnswered: number) {
    const filters = this.rangeFilters(query);

    const rows = await this.db
      .select({
        solverId: questions.solverId,
        name: user.name,
        answered: sql<number>`count(*)`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
        avgRespMin: sql<
          string | null
        >`avg(extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)`,
      })
      .from(questions)
      .innerJoin(user, eq(user.id, questions.solverId))
      .leftJoin(solutions, eq(solutions.questionId, questions.id))
      .where(and(...filters, sql`${questions.solverId} is not null`))
      .groupBy(questions.solverId, user.name);

    const shaped = rows.map((r) => {
      const satisfied = Number(r.satisfied);
      const unsatisfied = Number(r.unsatisfied);
      return {
        solverId: r.solverId,
        name: r.name,
        answered: Number(r.answered),
        satisfied,
        unsatisfied,
        satisfactionRate:
          satisfied + unsatisfied > 0
            ? satisfied / (satisfied + unsatisfied)
            : null,
        avgResponseMinutes: r.avgRespMin ? Number(r.avgRespMin) : null,
      };
    });

    const eligible = shaped.filter(
      (r) => r.answered >= minAnswered && r.satisfactionRate !== null,
    );
    const bySatisfaction = [...eligible].sort(
      (a, b) => (b.satisfactionRate ?? 0) - (a.satisfactionRate ?? 0),
    );
    const byAnswered = [...shaped].sort((a, b) => b.answered - a.answered);
    const bySpeed = [...eligible]
      .filter((r) => r.avgResponseMinutes !== null)
      .sort((a, b) => (a.avgResponseMinutes ?? 0) - (b.avgResponseMinutes ?? 0));

    return {
      eligibleCount: eligible.length,
      best: bySatisfaction.slice(0, 5),
      worst: [...bySatisfaction].reverse().slice(0, 5),
      mostAnswered: byAnswered[0] ?? null,
      highestSatisfaction: bySatisfaction[0] ?? null,
      fastest: bySpeed[0] ?? null,
    };
  }

  // ---------- payouts ----------

  /** Live figures for a range — the preview before a snapshot is taken. */
  async payoutPreview(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const rows = await this.db
      .select({
        solverId: questions.solverId,
        name: user.name,
        answered: sql<number>`count(*)`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')`,
        unrated: sql<number>`count(*) filter (where ${questions.status} = 'answered')`,
        avgRespMin: sql<
          string | null
        >`avg(extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)`,
      })
      .from(questions)
      .innerJoin(user, eq(user.id, questions.solverId))
      .leftJoin(solutions, eq(solutions.questionId, questions.id))
      .where(
        and(
          isNull(questions.deletedAt),
          gte(questions.answeredAt, fromDate),
          lte(questions.answeredAt, toDate),
          sql`${questions.solverId} is not null`,
        ),
      )
      .groupBy(questions.solverId, user.name);

    return rows.map((r) => ({
      solverId: r.solverId,
      name: r.name,
      answered: Number(r.answered),
      satisfied: Number(r.satisfied),
      unsatisfied: Number(r.unsatisfied),
      unrated: Number(r.unrated),
      avgRespMin: r.avgRespMin ? Number(r.avgRespMin) : null,
    }));
  }

  /**
   * Freezes the computed figures into payout_periods/payout_lines. `rate`
   * and `amount` stay null — payment itself happens manually outside this
   * system, and this is the record it's paid against.
   */
  async snapshotPayout(
    from: string,
    to: string,
    note: string | undefined,
    actorId: string,
  ) {
    const preview = await this.payoutPreview(from, to);

    const [period] = await this.db
      .insert(payoutPeriods)
      .values({
        fromDate: new Date(from),
        toDate: new Date(to),
        status: "draft",
        note,
      })
      .returning();

    if (!period) throw new Error("Failed to create payout period");

    if (preview.length > 0) {
      await this.db.insert(payoutLines).values(
        preview.map((line) => ({
          periodId: period.id,
          solverId: line.solverId as string,
          answered: line.answered,
          satisfied: line.satisfied,
          unsatisfied: line.unsatisfied,
          unrated: line.unrated,
          avgRespMin: line.avgRespMin?.toString() ?? null,
        })),
      );
    }

    await this.audit(actorId, "payout.snapshot", "payout_period", String(period.id));
    return { period, lines: preview.length };
  }

  async markPayoutPaid(periodId: number, actorId: string) {
    const [row] = await this.db
      .update(payoutPeriods)
      .set({ status: "paid", paidAt: new Date() })
      .where(eq(payoutPeriods.id, periodId))
      .returning();

    if (!row) return { error: "Payout period not found" as const };

    await this.audit(actorId, "payout.mark_paid", "payout_period", String(periodId));
    return { period: row };
  }

  async listPayouts() {
    return this.db
      .select()
      .from(payoutPeriods)
      .orderBy(desc(payoutPeriods.generatedAt));
  }
}
