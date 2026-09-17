import { and, desc, eq } from "drizzle-orm";
import type { DB } from "../../db";
import { auditLog, questions, reports } from "../../db/schema";
import type { ReportReason, ReportStatus } from "./reports.schema";

// A student reports a question that has been solved — these are the
// statuses that mean a solution exists.
const SOLVED_STATUSES = new Set(["answered", "satisfied", "unsatisfied"]);

export class ReportsService {
  constructor(private db: DB) {}

  async createReport(
    questionId: number,
    reporterId: string,
    reason: ReportReason,
    text: string,
  ) {
    const question = await this.db.query.questions.findFirst({
      where: eq(questions.id, questionId),
    });

    if (!question || question.deletedAt) {
      return { error: "Question not found" as const, status: 404 as const };
    }
    if (question.askerId !== reporterId) {
      return {
        error: "You can only report a question you asked" as const,
        status: 403 as const,
      };
    }
    if (!SOLVED_STATUSES.has(question.status)) {
      return {
        error: "This question hasn't been solved yet" as const,
        status: 400 as const,
      };
    }

    // One open report per student per question: repeats add nothing for the
    // admins and are an easy way to flood their queue.
    const alreadyOpen = await this.db.query.reports.findFirst({
      where: and(
        eq(reports.questionId, questionId),
        eq(reports.reporterId, reporterId),
        eq(reports.status, "open"),
      ),
      columns: { id: true },
    });
    if (alreadyOpen) {
      return {
        error: "You already have an open report for this question" as const,
        status: 409 as const,
      };
    }

    const [row] = await this.db
      .insert(reports)
      .values({ questionId, reporterId, reason, text, status: "open" })
      .returning();

    return { report: row };
  }

  async listMyReports(reporterId: string) {
    return this.db.query.reports.findMany({
      where: eq(reports.reporterId, reporterId),
      orderBy: desc(reports.createdAt),
    });
  }

  async listAdminReports(filters: {
    status?: ReportStatus;
    reason?: ReportReason;
  }) {
    const conditions = [];
    if (filters.status) conditions.push(eq(reports.status, filters.status));
    if (filters.reason) conditions.push(eq(reports.reason, filters.reason));

    return this.db.query.reports.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(reports.createdAt),
      with: {
        question: {
          columns: {
            id: true,
            text: true,
            status: true,
            subjectId: true,
            askedAt: true,
            solverId: true,
          },
        },
        reporter: { columns: { id: true, name: true } },
      },
    });
  }

  async resolveReport(id: number, staffId: string) {
    const [row] = await this.db
      .update(reports)
      .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: staffId })
      .where(eq(reports.id, id))
      .returning();

    if (!row) return { error: "Report not found" as const };

    await this.db.insert(auditLog).values({
      actorId: staffId,
      action: "report.resolve",
      entityType: "report",
      entityId: String(id),
    });

    return { report: row };
  }
}
