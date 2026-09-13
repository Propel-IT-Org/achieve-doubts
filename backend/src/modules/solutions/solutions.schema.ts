import { z } from "zod";

export const createSolutionSchema = z.object({
	doubtId: z.coerce.number().positive(),
	content: z.string().min(10),
	attachmentUrl: z.string().url().optional().nullable(),
});

export const solutionParamSchema = z.object({
	doubtId: z.coerce.number().positive(),
});

export type CreateSolutionInput = z.infer<typeof createSolutionSchema>;
