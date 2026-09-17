import { z } from "zod";
import { uploadUrl } from "../upload/upload.util";
import { hasAtLeastOneMediaField } from "./shared";

export const createThreadMessageSchema = z
  .object({
    text: z.string().trim().min(1).max(20_000).optional(),
    imageUrl: uploadUrl("image").optional(),
    audioUrl: uploadUrl("audio").optional(),
    // Matches the recorder's 15-minute limit (frontend lib/audio.ts).
    audioSeconds: z.number().int().positive().max(900).optional(),
  })
  .refine(hasAtLeastOneMediaField, {
    message: "Add text, an image, or an audio note",
  });

export type CreateThreadMessageInput = z.infer<typeof createThreadMessageSchema>;
