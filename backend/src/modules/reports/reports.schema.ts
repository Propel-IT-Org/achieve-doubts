import { z } from "zod";

export const reportReasonValues = [
  "wrong",
  "incomplete",
  "behaviour",
  "other",
] as const;
export const reportStatusValues = ["open", "resolved"] as const;

export const createReportSchema = z.object({
  reason: z.enum(reportReasonValues),
  text: z.string().min(10),
});

export const adminReportsQuerySchema = z.object({
  status: z.enum(reportStatusValues).optional(),
  reason: z.enum(reportReasonValues).optional(),
});

export type ReportReason = (typeof reportReasonValues)[number];
export type ReportStatus = (typeof reportStatusValues)[number];
