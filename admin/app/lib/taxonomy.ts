import { useMemo } from "react";
import { useTaxonomyTree } from "./queries";

export type TaxonomyLookup = {
  subjectName: (id: string) => string;
  bookName: (id: string) => string;
  chapterName: (id: number) => string;
};

/** Suspends until the taxonomy tree is loaded; returns id → name lookups. */
export function useTaxonomy(): TaxonomyLookup {
  const levels = useTaxonomyTree();
  return useMemo(() => {
    const names = new Map<string, string>();
    const chapters = new Map<number, string>();
    for (const level of levels) {
      for (const subject of level.subjects) {
        names.set(`s:${subject.id}`, subject.nameEn);
        for (const book of subject.books) {
          names.set(`b:${book.id}`, book.nameEn);
          for (const chapter of book.chapters) chapters.set(chapter.id, chapter.nameEn);
        }
      }
    }
    return {
      subjectName: (id) => names.get(`s:${id}`) ?? id,
      bookName: (id) => names.get(`b:${id}`) ?? id,
      chapterName: (id) => chapters.get(id) ?? "",
    };
  }, [levels]);
}

/** Where "Open on main site" leads. */
export const MAIN_SITE_URL: string =
  import.meta.env.VITE_MAIN_SITE_URL ?? "http://localhost:5173";
