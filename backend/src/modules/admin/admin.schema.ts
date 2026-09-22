import { z } from "zod";

export const activeBodySchema = z.object({ active: z.boolean() });

/**
 * Sorting a paged list has to happen in SQL — sorting one page would order
 * the wrong rows. "recent" is newest first; the rest read naturally
 * (A→Z, most questions first), so each has its own default direction.
 */
export const studentSortValues = ["recent", "name", "asked", "satisfaction"] as const;

export const studentSearchQuerySchema = z.object({
  q: z.string().max(100).optional(),
  sort: z.enum(studentSortValues).default("recent"),
  dir: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type StudentSort = (typeof studentSortValues)[number];
export type StudentSearchQuery = z.infer<typeof studentSearchQuerySchema>;

export const createSolverSchema = z.object({
  name: z.string().min(1),
  // Solvers sign in with this email and the password below.
  email: z.email(),
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
  // The class this cohort studies. Optional: a batch with no class sees
  // every level's taxonomy, which is what existing batches did.
  levelId: z.string().min(1).max(32).nullable().default(null),
});

export const updateBatchSchema = z
  .object({
    label: z.string().min(1),
    levelId: z.string().min(1).max(32).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const quotaSchema = z.object({
  maxPerDay: z.number().int().positive().nullable(),
  maxPerMonth: z.number().int().positive().nullable(),
});

/**
 * A calendar date (`2026-09-30`, meaning that whole day) or a full ISO
 * timestamp. Free text used to reach `new Date()` unchecked and surface as a
 * 500 from Postgres.
 */
const dateBound = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

const inOrder = (value: { from?: string; to?: string }) =>
  !value.from || !value.to || new Date(value.from) <= new Date(value.to);
const orderMessage = { message: "`from` must not be after `to`", path: ["to"] };

const rangeFields = {
  from: dateBound.optional(),
  to: dateBound.optional(),
  subject: z.string().optional(),
  solver: z.string().optional(),
};

// Built from shared fields rather than `.extend()`: zod 4 refuses to extend
// an object schema that already carries a refinement.
export const rangeQuerySchema = z.object(rangeFields).refine(inOrder, orderMessage);

export const rankingsQuerySchema = z
  .object({
    ...rangeFields,
    minAnswered: z.coerce.number().int().min(1).default(20),
  })
  .refine(inOrder, orderMessage);

export const payoutSnapshotSchema = z
  .object({
    from: dateBound,
    to: dateBound,
    note: z.string().max(500).optional(),
  })
  .refine(inOrder, orderMessage);

export type CreateSolverInput = z.infer<typeof createSolverSchema>;
export type QuotaInput = z.infer<typeof quotaSchema>;
export type RangeQuery = z.infer<typeof rangeQuerySchema>;
