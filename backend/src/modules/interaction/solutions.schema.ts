import { z } from "zod";
import { hasAtLeastOneMediaField } from "./shared";

export const createSolutionSchema = z
  .object({
    text: z.string().trim().min(1).max(20_000).optional(),
    imageUrl: z.url().optional(),
    audioUrl: z.url().optional(),
    audioSeconds: z.number().int().positive().max(3600).optional(),
  })
  .refine(hasAtLeastOneMediaField, {
    message: "Add text, an image, or an audio note",
  });

export type CreateSolutionInput = z.infer<typeof createSolutionSchema>;

export const ratingSchema = z.object({
  value: z.enum(["satisfied", "unsatisfied"]),
});

export type RatingInput = z.infer<typeof ratingSchema>;
