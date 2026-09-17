import { useMemo } from "react";
import type { Subject } from "./queries";
import { useSubjects } from "./queries";

export type TaxonomyLookup = {
  subjectName: (id: string) => string;
  bookName: (id: string) => string;
  chapterName: (id: number) => string;
  chapterNumber: (id: number) => number;
};

/**
 * Builds the id -> display-name lookups the cards need, from the taxonomy
 * tree the API returns. One lookup per list, not one per row.
 */
export function buildTaxonomyLookup(subjects: Subject[]): TaxonomyLookup {
  const subjectNames = new Map<string, string>();
  const bookNames = new Map<string, string>();
  const chapterNames = new Map<number, string>();
  const chapterNumbers = new Map<number, number>();

  for (const subject of subjects) {
    subjectNames.set(subject.id, subject.nameEn);
    for (const book of subject.books) {
      bookNames.set(book.id, book.nameEn);
      for (const chapter of book.chapters) {
        chapterNames.set(chapter.id, chapter.nameEn);
        chapterNumbers.set(chapter.id, chapter.number);
      }
    }
  }

  return {
    subjectName: (id) => subjectNames.get(id) ?? id,
    bookName: (id) => bookNames.get(id) ?? id,
    chapterName: (id) => chapterNames.get(id) ?? "",
    chapterNumber: (id) => chapterNumbers.get(id) ?? 0,
  };
}

/** Suspends until the taxonomy tree is loaded. */
export function useTaxonomy(): TaxonomyLookup {
  const subjects = useSubjects();
  return useMemo(() => buildTaxonomyLookup(subjects), [subjects]);
}
