import { z } from "zod";

export const activeBodySchema = z.object({ active: z.boolean() });

export const studentSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createSolverSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8),
  phone: z.string().min(6).optional(),
  institution: z.string().optional(),
  dept: z.string().optional(),
  batch: z.coerce.number().int().optional(),
});

export const solverAdminFlagSchema = z.object({ isAdminSolver: z.boolean() });

export const createBatchSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1),
});

export const quotaSchema = z.object({
  maxPerDay: z.number().int().positive().nullable(),
  maxPerMonth: z.number().int().positive().nullable(),
});

export const rangeQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  solver: z.string().optional(),
});

export const rankingsQuerySchema = rangeQuerySchema.extend({
  minAnswered: z.coerce.number().int().min(1).default(20),
});

export const payoutSnapshotSchema = z.object({
  from: z.string(),
  to: z.string(),
  note: z.string().optional(),
});

export type CreateSolverInput = z.infer<typeof createSolverSchema>;
export type QuotaInput = z.infer<typeof quotaSchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
