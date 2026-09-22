import { z } from "zod";

// Names are what staff type; ids are generated from the English name, so
// none of these schemas accept one.

const name = z.string().trim().min(1).max(160);
const sort = z.number().int().min(0).max(999);
const id = z.string().trim().min(1).max(32);

/** Rejects `{}`, which would otherwise be an update that changes nothing. */
const partial = <T extends z.ZodRawShape>(shape: T) =>
	z
		.object(shape)
		.partial()
		.refine((value) => Object.keys(value).length > 0, "Nothing to update");

export const createLevelSchema = z.object({
	nameEn: name,
	nameBn: name,
	sort: sort.default(0),
});
export const updateLevelSchema = partial({ nameEn: name, nameBn: name, sort });

export const createSubjectSchema = z.object({
	levelId: id,
	nameEn: name,
	nameBn: name,
	sort: sort.default(0),
});
export const updateSubjectSchema = partial({
	levelId: id,
	nameEn: name,
	nameBn: name,
	sort,
});

export const createBookSchema = z.object({
	subjectId: id,
	nameEn: name,
	nameBn: name,
	sort: sort.default(0),
});
export const updateBookSchema = partial({ nameEn: name, nameBn: name, sort });

const chapterNumber = z.number().int().min(1).max(999);

export const createChapterSchema = z.object({
	bookId: id,
	// Left out, the chapter goes after the book's last one.
	number: chapterNumber.optional(),
	nameEn: name,
	nameBn: name,
});
export const updateChapterSchema = partial({
	number: chapterNumber,
	nameEn: name,
	nameBn: name,
});
