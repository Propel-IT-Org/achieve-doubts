import { z } from "zod";

/** Mirrors the backend's createQuestionSchema, including its 15-char floor. */
export const askSchema = z.object({
  subjectId: z.string().min(1, "Choose a subject, paper and chapter."),
  bookId: z.string().min(1, "Choose a subject, paper and chapter."),
  chapterId: z.coerce.number().int().positive("Choose a subject, paper and chapter."),
  // Optional: the student's book may not be listed. "" means none chosen.
  textbookId: z.string(),
  text: z
    .string()
    .min(15, "Write at least 15 characters so the solver understands the problem."),
});

export type AskForm = z.input<typeof askSchema>;
