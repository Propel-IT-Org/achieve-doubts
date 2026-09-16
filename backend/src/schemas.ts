/**
 * Request schemas shared with the frontend via the
 * `@achieve/doubts-backend/schemas` export.
 *
 * Only genuinely shared *request* shapes belong here — the frontend builds
 * its forms against these so validation can't drift between the two sides.
 * DB/internal schemas stay private to their modules.
 */

export {
  createQuestionSchema,
  listQuestionsQuerySchema,
  questionIdParamSchema,
} from "./modules/questions/questions.schema";

export {
  createSolutionSchema,
  ratingSchema,
} from "./modules/interaction/solutions.schema";

export { createThreadMessageSchema } from "./modules/interaction/thread.schema";
export { createCommentSchema } from "./modules/interaction/comments.schema";

export {
  createReportSchema,
  reportReasonValues,
  reportStatusValues,
} from "./modules/reports/reports.schema";

export {
  activeBodySchema,
  createBatchSchema,
  createSolverSchema,
  payoutSnapshotSchema,
  quotaSchema,
  rangeQuerySchema,
  rankingsQuerySchema,
  solverAdminFlagSchema,
  studentSearchQuerySchema,
} from "./modules/admin/admin.schema";
