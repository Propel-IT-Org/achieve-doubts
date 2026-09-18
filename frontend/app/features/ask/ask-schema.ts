import { z } from "zod";

/** Mirrors the backend's createQuestionSchema, including its 15-char floor. */
export const askSchema = z.object({
  subjectId: z.string().min(1, "Choose a subject, book and chapter."),
  bookId: z.string().min(1, "Choose a subject, book and chapter."),
  chapterId: z.coerce.number().int().positive("Choose a subject, book and chapter."),
  text: z
    .string()
    .min(15, "Write at least 15 characters so the solver understands the problem."),
});

export type AskForm = z.input<typeof askSchema>;
