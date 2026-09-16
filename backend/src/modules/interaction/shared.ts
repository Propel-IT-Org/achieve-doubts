import type { Context } from "hono";
import { isOwnUploadUrl } from "../upload/upload.util";

/** Shape shared by the solution/thread/comment "add media" request bodies. */
export type MediaInput = {
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
};

/**
 * zod `.refine()` predicate matching the prototype's "add text, an image, or
 * an audio note" rule — at least one of the three must be present.
 */
export function hasAtLeastOneMediaField(data: MediaInput): boolean {
  return Boolean(data.text || data.imageUrl || data.audioUrl);
}

/** Rejects media URLs that didn't come from our own presign flow. */
export function validateMediaUrls(input: MediaInput): string | null {
  if (input.imageUrl && !isOwnUploadUrl(input.imageUrl)) {
    return "imageUrl must be a URL returned by the upload presign flow";
  }
  if (input.audioUrl && !isOwnUploadUrl(input.audioUrl)) {
    return "audioUrl must be a URL returned by the upload presign flow";
  }
  return null;
}

/**
 * Re-exported so the interaction routers keep their existing import site.
 * The hook itself now lives with the rest of the error contract.
 */
export { zodErrorHook } from "../../lib/errors";

/** Parses a `:id`-style route param into a positive integer, or null. */
export function parseIdParam(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

type SoftDeletableRow = {
  deletedAt: Date | null;
  text: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  audioSeconds: number | null;
};

/**
 * Thread messages and comments share one soft-delete rule: a deleted row
 * stays in the list (so ordering isn't disturbed) but its content is
 * scrubbed and a `deleted: true` flag takes its place — matching the
 * prototype's "Removed by an admin" placeholder.
 */
export function shapeSoftDeletable<T extends SoftDeletableRow>(
  row: T,
): T & { deleted: boolean } {
  if (row.deletedAt) {
    return {
      ...row,
      text: null,
      imageUrl: null,
      audioUrl: null,
      audioSeconds: null,
      deleted: true,
    };
  }
  return { ...row, deleted: false };
}
