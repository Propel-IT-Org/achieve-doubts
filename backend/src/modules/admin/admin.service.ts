import {
  type AnyColumn,
  type SQL,
  and,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { DB } from "../../db";
import {
  askQuotaPolicies,
  auditLog,
  batches,
  levels,
  payoutLines,
  payoutPeriods,
  questions,
  solutions,
  solverProfiles,
  studentProfiles,
  user,
} from "../../db/schema";
import type { Auth } from "../../lib/auth";
import type { AppRole } from "../../lib/permissions";
import { containsPattern } from "../interaction/shared";
import {
  isLockBlocked,
  pendingFollowupCondition,
  solverSatisfactionRate,
} from "../profiles/solver-stats.util";
import type {
  CreateSolverInput,
  QuotaInput,
  RangeQuery,
  StudentSearchQuery,
} from "./admin.schema";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Upper bound of a date range. A bare date means "through the end of that
 * day": `to=2026-09-30` must include the 30th, but compared as a timestamp it
 * is midnight at the START of the 30th and silently drops the whole day.
 * Dates are UTC.
 */
function upperBound(column: AnyColumn, to: string) {
  if (!DATE_ONLY.test(to)) return lte(column, new Date(to));
  const nextDay = new Date(`${to}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return lt(column, nextDay);
}

/** The last instant a range includes, for storing it on a payout period. */
function rangeEnd(to: string): Date {
  if (!DATE_ONLY.test(to)) return new Date(to);
  return new Date(`${to}T23:59:59.999Z`);
}

const batchBanReason = (batchId: string) => `Batch ${batchId} deactivated`;

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

  /**
   * One page of students matching `q`, each with their question and rating
   * counts, plus how many match in total and how many of those are active.
   */
  async listStudents({ q, sort, dir, limit, offset }: StudentSearchQuery) {
    const search = q?.trim();
    const filters = [eq(user.role, "student")];
    if (search) {
      const like = containsPattern(search);
      const match = or(
        ilike(user.name, like),
        ilike(user.email, like),
        ilike(studentProfiles.college, like),
        ilike(studentProfiles.district, like),
      );
      if (match) filters.push(match);
    }
    const where = and(...filters);

    // Per-asker counts, computed once and joined, rather than per row.
    const asked = this.db
      .select({
        askerId: questions.askerId,
        asked: sql<number>`count(*)::int`.as("asked"),
        satisfied:
          sql<number>`count(*) filter (where ${questions.status} = 'satisfied')::int`.as(
            "satisfied",
          ),
        unsatisfied:
          sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')::int`.as(
            "unsatisfied",
          ),
      })
      .from(questions)
      .where(isNull(questions.deletedAt))
      .groupBy(questions.askerId)
      .as("asked");

    // Sorting must happen in SQL: ordering one page would order the wrong
    // rows. Each column starts in the direction an admin expects (newest,
    // A→Z, most questions), which `dir` flips. Every ordering ends on the
    // id, so paging can't repeat or skip a row when two students tie.
    const satisfaction = sql`(${asked.satisfied}::numeric / nullif(${asked.satisfied} + ${asked.unsatisfied}, 0))`;
    const descending = (dir ?? (sort === "name" ? "asc" : "desc")) === "desc";
    const direction = (column: SQL) =>
      descending ? sql`${column} desc` : sql`${column} asc`;
    const order: SQL[] = [
      sort === "name"
        ? direction(sql`${user.name}`)
        : sort === "asked"
          ? direction(sql`coalesce(${asked.asked}, 0)`)
          : sort === "satisfaction"
            // A student with no rating has no rate; that is not a low one,
            // so they sort last whichever way the column is pointed.
            ? sql`${direction(satisfaction)} nulls last`
            : direction(sql`${user.createdAt}`),
      sql`${user.id} asc`,
    ];

    const [rows, [totals]] = await Promise.all([
      this.db
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
          asked: sql<number>`coalesce(${asked.asked}, 0)`,
          satisfied: sql<number>`coalesce(${asked.satisfied}, 0)`,
          unsatisfied: sql<number>`coalesce(${asked.unsatisfied}, 0)`,
        })
        .from(user)
        .leftJoin(studentProfiles, eq(studentProfiles.userId, user.id))
        .leftJoin(asked, eq(asked.askerId, user.id))
        .where(where)
        .orderBy(...order)
        .limit(limit)
        .offset(offset),
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where coalesce(${user.banned}, false) = false)::int`,
        })
        .from(user)
        .leftJoin(studentProfiles, eq(studentProfiles.userId, user.id))
        .where(where),
    ]);

    return {
      students: rows.map((row) => ({
        ...row,
        asked: row.asked,
        satisfied: row.satisfied,
        unsatisfied: row.unsatisfied,
      })),
      total: totals?.total ?? 0,
      active: totals?.active ?? 0,
    };
  }

  async getStudent(id: string) {
    const [row] = await this.db
      .select({
        user: getTableColumns(user),
        student_profiles: getTableColumns(studentProfiles),
        batch: {
          id: batches.id,
          label: batches.label,
          active: batches.active,
          levelId: batches.levelId,
          levelName: levels.nameEn,
        },
      })
      .from(user)
      .leftJoin(studentProfiles, eq(studentProfiles.userId, user.id))
      .leftJoin(batches, eq(batches.id, studentProfiles.batchId))
      .leftJoin(levels, eq(levels.id, batches.levelId))
      .where(and(eq(user.id, id), eq(user.role, "student")));

    if (!row) return null;

    const [stats] = await this.db
      .select({
        asked: sql<number>`count(*)::int`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')::int`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')::int`,
      })
      .from(questions)
      .where(and(eq(questions.askerId, id), isNull(questions.deletedAt)));

    return {
      ...row,
      // A whole table nullifies itself when a left join misses; an object
      // built column by column comes back with every field null instead.
      batch: row.batch.id ? row.batch : null,
      stats: {
        asked: stats?.asked ?? 0,
        satisfied: stats?.satisfied ?? 0,
        unsatisfied: stats?.unsatisfied ?? 0,
      },
    };
  }

  /**
   * Deactivation goes through better-auth's ban API rather than a local
   * flag, so existing sessions are revoked and future sign-ins are refused
   * by the framework itself.
   */
  async setUserActive({
    userId,
    active,
    expectedRoles,
    headers,
    actorId,
  }: {
    userId: string;
    active: boolean;
    expectedRoles: readonly AppRole[];
    headers: Headers;
    actorId: string;
  }): Promise<{ ok: true } | { error: "not_found" | "self" }> {
    // Deactivating yourself signs you out mid-task and, for the last staff
    // account, leaves nobody able to undo it.
    if (userId === actorId) return { error: "self" };

    const [target] = await this.db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, userId));

    // Each route names the kind of account it acts on. Without this check,
    // /admin/students/:id/active would ban any account at all, staff included.
    if (!target || !expectedRoles.includes(target.role as AppRole)) {
      return { error: "not_found" };
    }

    const reason = "Deactivated by an administrator";
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
    return { ok: true };
  }

  // ---------- solvers ----------

  async listSolvers() {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
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

    // One grouped pass over questions for every solver, not two queries each.
    const aggregates = await this.db
      .select({
        solverId: questions.solverId,
        solved: sql<number>`count(*) filter (where ${questions.status} in ('answered','satisfied','unsatisfied'))::int`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')::int`,
        pending: sql<number>`count(*) filter (where ${pendingFollowupCondition()})::int`,
      })
      .from(questions)
      .where(
        and(
          isNotNull(questions.solverId),
          isNull(questions.deletedAt),
        ),
      )
      .groupBy(questions.solverId);
    const bySolver = new Map(aggregates.map((agg) => [agg.solverId, agg]));

    return rows.map((row) => {
      const agg = bySolver.get(row.id);
      const solved = agg?.solved ?? 0;
      return {
        ...row,
        isAdminSolver: row.role === "adminSolver",
        solved,
        satisfactionRate: solverSatisfactionRate(agg?.satisfied ?? 0, solved),
        pendingFollowups: agg?.pending ?? 0,
        lockBlocked: isLockBlocked(agg?.pending ?? 0),
      };
    });
  }

  async createSolver(
    input: CreateSolverInput,
    headers: Headers,
    actorId: string,
  ) {
    // better-auth stores and matches emails lowercased; check the same way,
    // or "Ana@x.com" would pass here and then collide in createUser.
    const email = input.email.trim().toLowerCase();
    const [emailTaken] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email));
    if (emailTaken) return { error: "That email is already in use" as const };

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
        email,
        password: input.password,
        name: input.name,
        role: "solver",
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
  ): Promise<{ ok: true } | { error: "not_found" }> {
    const [target] = await this.db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, userId));

    // Only an existing solver can be promoted or demoted. Without this check
    // the route would turn a student into an admin solver, or demote staff.
    if (target?.role !== "solver" && target?.role !== "adminSolver") {
      return { error: "not_found" };
    }

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
    return { ok: true };
  }

  // ---------- batches ----------

  /** Every batch, with how many students it holds and how many can log in. */
  async listBatches() {
    const enrolled = this.db
      .select({
        batchId: studentProfiles.batchId,
        students: sql<number>`count(*)::int`.as("students"),
        activeStudents:
          sql<number>`count(*) filter (where coalesce(${user.banned}, false) = false)::int`.as(
            "active_students",
          ),
      })
      .from(studentProfiles)
      .innerJoin(user, eq(user.id, studentProfiles.userId))
      .groupBy(studentProfiles.batchId)
      .as("enrolled");

    const rows = await this.db
      .select({
        ...getTableColumns(batches),
        levelName: levels.nameEn,
        students: enrolled.students,
        activeStudents: enrolled.activeStudents,
      })
      .from(batches)
      .leftJoin(levels, eq(levels.id, batches.levelId))
      .leftJoin(enrolled, eq(enrolled.batchId, batches.id))
      .orderBy(desc(batches.createdAt));

    // The join misses batches nobody is enrolled in, hence the nulls.
    return rows.map((row) => ({
      ...row,
      students: row.students ?? 0,
      activeStudents: row.activeStudents ?? 0,
    }));
  }

  /**
   * `id` must be exactly the `Batch` value Achieve sends in the SSO
   * handshake — it is compared as-is — so it is only trimmed, never
   * lower-cased or otherwise rewritten.
   */
  async createBatch(
    rawId: string,
    rawLabel: string,
    levelId: string | null,
    actorId: string,
  ) {
    const id = rawId.trim();
    const label = rawLabel.trim();

    const [existing] = await this.db
      .select({ id: batches.id })
      .from(batches)
      .where(eq(batches.id, id));
    if (existing) return { error: "That batch already exists" as const };

    if (levelId && !(await this.levelExists(levelId))) {
      return { error: "That class doesn't exist" as const };
    }

    const [row] = await this.db
      .insert(batches)
      .values({ id, label, active: true, levelId, createdAt: new Date() })
      .returning();

    await this.audit(actorId, "batch.create", "batch", id);
    return { batch: row };
  }

  /**
   * The label and the class. The id is Achieve's and is never editable —
   * changing it would orphan every student the SSO handshake put in it.
   *
   * Moving a batch to another class changes which syllabus its students can
   * ask against; questions already asked keep their original taxonomy.
   */
  async updateBatch(
    id: string,
    input: { label?: string; levelId?: string | null },
    actorId: string,
  ) {
    if (input.levelId && !(await this.levelExists(input.levelId))) {
      return { error: "That class doesn't exist" as const };
    }

    const [row] = await this.db
      .update(batches)
      .set({
        ...(input.label === undefined ? {} : { label: input.label.trim() }),
        ...(input.levelId === undefined ? {} : { levelId: input.levelId }),
      })
      .where(eq(batches.id, id))
      .returning();

    if (!row) return { error: "Batch not found" as const };

    await this.audit(actorId, "batch.update", "batch", id, input);
    return { batch: row };
  }

  /**
   * The foreign key would refuse an unknown level too, but as a 500; this
   * turns it into a message staff can act on.
   */
  private async levelExists(levelId: string) {
    const [level] = await this.db
      .select({ id: levels.id })
      .from(levels)
      .where(eq(levels.id, levelId));
    return Boolean(level);
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
      .select({
        userId: studentProfiles.userId,
        banned: user.banned,
        banReason: user.banReason,
      })
      .from(studentProfiles)
      .innerJoin(user, eq(user.id, studentProfiles.userId))
      .where(eq(studentProfiles.batchId, batchId));

    // Touch only the bans this batch owns. Deactivating skips students who
    // are already banned for another reason — overwriting their ban reason
    // would let a later reactivation lift a ban staff imposed individually.
    // Reactivating, likewise, lifts only bans this batch put in place.
    const reason = batchBanReason(batchId);
    const affected = members.filter((member) =>
      active
        ? member.banned === true && member.banReason === reason
        : member.banned !== true,
    );

    for (const member of affected) {
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
      { affectedStudents: affected.length },
    );

    return { batch, affectedStudents: affected.length };
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

  /**
   * Analytics count ANSWERED questions, dated by when they were answered —
   * the same basis as the invoice, so the two pages agree for a range.
   */
  private rangeFilters(query: RangeQuery) {
    const filters = [isNull(questions.deletedAt), isNotNull(questions.answeredAt)];
    if (query.from) filters.push(gte(questions.answeredAt, new Date(query.from)));
    if (query.to) filters.push(upperBound(questions.answeredAt, query.to));
    if (query.subject) filters.push(eq(questions.subjectId, query.subject));
    if (query.solver) filters.push(eq(questions.solverId, query.solver));
    return filters;
  }

  async analytics(query: RangeQuery) {
    const filters = this.rangeFilters(query);

    const perSubject = await this.db
      .select({
        subjectId: questions.subjectId,
        total: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(and(...filters))
      .groupBy(questions.subjectId);

    const [totals] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')::int`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')::int`,
        unrated: sql<number>`count(*) filter (where ${questions.status} = 'answered')::int`,
        avgMatchSec: sql<number | null>`avg(${questions.matchedAfterSec})::float8`,
      })
      .from(questions)
      .where(and(...filters));

    const trend = await this.db
      .select({
        day: sql<string>`date_trunc('day', ${questions.answeredAt})::date`,
        total: sql<number>`count(*)::int`,
      })
      .from(questions)
      .where(and(...filters))
      .groupBy(sql`date_trunc('day', ${questions.answeredAt})`)
      .orderBy(sql`date_trunc('day', ${questions.answeredAt})`);

    const [resp] = await this.db
      .select({
        avgMinutes: sql<
          number | null
        >`avg(extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)::float8`,
      })
      .from(solutions)
      .innerJoin(questions, eq(solutions.questionId, questions.id))
      .where(and(...filters, isNull(solutions.deletedAt)));

    return {
      perSubject: perSubject.map((r) => ({
        subjectId: r.subjectId,
        total: r.total,
      })),
      satisfaction: {
        satisfied: totals?.satisfied ?? 0,
        unsatisfied: totals?.unsatisfied ?? 0,
        unrated: totals?.unrated ?? 0,
      },
      total: totals?.total ?? 0,
      avgMatchSeconds: totals?.avgMatchSec ?? null,
      avgResponseMinutes: resp?.avgMinutes ?? null,
      trend: trend.map((r) => ({ day: r.day, total: r.total })),
    };
  }

  async rankings(query: RangeQuery, minAnswered: number) {
    const filters = this.rangeFilters(query);

    const rows = await this.db
      .select({
        solverId: questions.solverId,
        name: user.name,
        banned: user.banned,
        answered: sql<number>`count(*)::int`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')::int`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')::int`,
        avgRespMin: sql<
          number | null
        >`avg(extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)::float8`,
      })
      .from(questions)
      .innerJoin(user, eq(user.id, questions.solverId))
      .leftJoin(solutions, eq(solutions.questionId, questions.id))
      .where(and(...filters))
      .groupBy(questions.solverId, user.name, user.banned);

    const shaped = rows.map((r) => {
      const satisfied = r.satisfied;
      const unsatisfied = r.unsatisfied;
      return {
        solverId: r.solverId,
        name: r.name,
        active: r.banned !== true,
        answered: r.answered,
        satisfied,
        unsatisfied,
        satisfactionRate:
          satisfied + unsatisfied > 0
            ? satisfied / (satisfied + unsatisfied)
            : null,
        avgResponseMinutes: r.avgRespMin ?? null,
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
      /** Solvers with at least one answer in the range. */
      rankedCount: shaped.length,
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

    const rows = await this.db
      .select({
        solverId: questions.solverId,
        name: user.name,
        answered: sql<number>`count(*)::int`,
        satisfied: sql<number>`count(*) filter (where ${questions.status} = 'satisfied')::int`,
        unsatisfied: sql<number>`count(*) filter (where ${questions.status} = 'unsatisfied')::int`,
        unrated: sql<number>`count(*) filter (where ${questions.status} = 'answered')::int`,
        avgRespMin: sql<
          number | null
        >`avg(extract(epoch from (${solutions.createdAt} - ${questions.lockedAt})) / 60)::float8`,
      })
      .from(questions)
      .innerJoin(user, eq(user.id, questions.solverId))
      .leftJoin(solutions, eq(solutions.questionId, questions.id))
      .where(
        and(
          isNull(questions.deletedAt),
          gte(questions.answeredAt, fromDate),
          upperBound(questions.answeredAt, to),
          sql`${questions.solverId} is not null`,
        ),
      )
      .groupBy(questions.solverId, user.name);

    return rows.map((r) => ({
      solverId: r.solverId,
      name: r.name,
      answered: r.answered,
      satisfied: r.satisfied,
      unsatisfied: r.unsatisfied,
      unrated: r.unrated,
      avgRespMin: r.avgRespMin ?? null,
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

    // One transaction, so a failure can't leave a period with no lines.
    const period = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(payoutPeriods)
        .values({
          fromDate: new Date(from),
          toDate: rangeEnd(to),
          status: "draft",
          note,
        })
        .returning();

      if (!created) throw new Error("Failed to create payout period");

      if (preview.length > 0) {
        await tx.insert(payoutLines).values(
          preview.map((line) => ({
            periodId: created.id,
            solverId: line.solverId as string,
            answered: line.answered,
            satisfied: line.satisfied,
            unsatisfied: line.unsatisfied,
            unrated: line.unrated,
            avgRespMin: line.avgRespMin?.toString() ?? null,
          })),
        );
      }
      return created;
    });

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
