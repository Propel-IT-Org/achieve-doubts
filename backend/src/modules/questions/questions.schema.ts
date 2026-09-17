import { z } from "zod";
import { uploadUrl } from "../upload/upload.util";

const questionStatusValues = [
	"waiting",
	"assigned",
	"answered",
	"satisfied",
	"unsatisfied",
] as const;

export const questionIdParamSchema = z.object({
	id: z.coerce.number().int().positive(),
});

export const createQuestionSchema = z.object({
	subjectId: z.string().min(1),
	bookId: z.string().min(1),
	chapterId: z.coerce.number().int().positive(),
	text: z.string().min(15),
	photoUrl: uploadUrl("image").optional().nullable(),
});

export const listQuestionsQuerySchema = z.object({
	subject: z.string().optional(),
	book: z.string().optional(),
	chapter: z.coerce.number().int().positive().optional(),
	status: z.enum(questionStatusValues).optional(),
	q: z.string().optional(),
	// Query params arrive as strings — coerce explicitly rather than
	// z.coerce.boolean(), which treats any non-empty string (including
	// "false") as true.
	mine: z
		.union([z.literal("true"), z.literal("false")])
		.optional()
		.transform((v) => v === "true"),
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(50).default(10),
});

// Validated shape of the base64-JSON keyset cursor. A cursor that fails this
// parse is treated as absent rather than 500ing on `new Date(undefined)`.
export const cursorPayloadSchema = z.object({
	askedAt: z
		.string()
		.refine((v) => !Number.isNaN(Date.parse(v)), "invalid askedAt"),
	id: z.number().int().positive(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type ListQuestionsQuery = z.infer<typeof listQuestionsQuerySchema>;
export type CursorPayload = z.infer<typeof cursorPayloadSchema>;
