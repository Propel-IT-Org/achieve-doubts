import { z } from "zod";

export const createDoubtSchema = z.object({
	title: z.string().min(3).max(255),
	description: z.string().min(10),
	subject: z.string().min(2).max(64),
	imageUrl: z.url().optional().nullable(),
});

export const listDoubtsQuerySchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().min(1).max(50).default(10),
	subject: z.string().optional(),
	status: z.enum(["UNLOCKED", "LOCKED", "RESOLVED", "EXPIRED"]).optional(),
});

export const doubtIdParamSchema = z.object({
	id: z.coerce.number().positive(),
});

export type CreateDoubtInput = z.infer<typeof createDoubtSchema>;
export type ListDoubtsQuery = z.infer<typeof listDoubtsQuerySchema>;
