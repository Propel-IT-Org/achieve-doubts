/** Shape shared by the solution/thread/comment "add media" request bodies. */
type MediaInput = {
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

/**
 * Escapes LIKE/ILIKE wildcards, so a search for "50%" matches that text
 * rather than every row starting with "50".
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, "\\$&")}%`;
}

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
