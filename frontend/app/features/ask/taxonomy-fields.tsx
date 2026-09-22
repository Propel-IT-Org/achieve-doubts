import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTaxonomyTree } from "~/lib/queries";
import type { AskForm } from "./ask-schema";

/** Disabled stand-ins with the same layout, while the tree loads. */
export function TaxonomyFieldsPlaceholder() {
  return (
    <div className="ask-grid">
      {["Subject", "Book", "Chapter"].map((label) => (
        <label className="field" key={label}>
          <span>{label}</span>
          <select className="select" disabled>
            <option>Loading…</option>
          </select>
        </label>
      ))}
    </div>
  );
}

/** Cascading subject → book → chapter selects. Suspends on the taxonomy. */
export function TaxonomyFields() {
  // A student's tree holds exactly their class. It can hold more than one
  // when their batch has no class set, hence the group labels — the API
  // decides which subjects they may ask under, never this.
  const levels = useTaxonomyTree();
  const subjects = levels.flatMap((level) => level.subjects);
  const { register, watch, setValue } = useFormContext<AskForm>();

  const subjectId = watch("subjectId");
  const bookId = watch("bookId");
  const books = subjects.find((s) => s.id === subjectId)?.books ?? [];
  const chapters = books.find((b) => b.id === bookId)?.chapters ?? [];
  const chapterId = watch("chapterId");

  // A select with one option asks a question that has one answer. Class
  // 9-10 has only the NCTB book, so choosing the subject is the whole
  // decision — fill the rest in rather than making them click through it.
  useEffect(() => {
    if (!subjectId) {
      if (subjects.length === 1) setValue("subjectId", subjects[0].id);
      return;
    }
    if (!bookId) {
      if (books.length === 1) setValue("bookId", books[0].id);
      return;
    }
    if (!chapterId && chapters.length === 1) setValue("chapterId", chapters[0].id);
  }, [subjects, books, chapters, subjectId, bookId, chapterId, setValue]);

  // The tree a student gets is their class's alone, so an empty one means
  // their class has no syllabus loaded yet — not that the request failed.
  if (subjects.length === 0) {
    return (
      <div className="callout warn" role="status">
        <AlertTriangle size={20} />
        <div>
          <h3>Your class isn't set up yet</h3>
          <p>
            No subjects have been added for your class, so questions can't be
            filed yet. Tell your teacher, and it will be sorted out.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ask-grid">
      <label className="field">
        <span>Subject</span>
        <select
          className="select"
          {...register("subjectId")}
          onChange={(e) => {
            setValue("subjectId", e.target.value);
            setValue("bookId", "");
            setValue("chapterId", 0);
          }}
        >
          <option value="">Choose</option>
          {levels.map((level) => (
            <optgroup key={level.id} label={level.nameEn}>
              {level.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Book</span>
        <select
          className="select"
          disabled={!subjectId}
          {...register("bookId")}
          onChange={(e) => {
            setValue("bookId", e.target.value);
            setValue("chapterId", 0);
          }}
        >
          <option value="">{subjectId ? "Choose" : "Choose a subject first"}</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameEn}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Chapter</span>
        <select className="select" disabled={!bookId} {...register("chapterId")}>
          <option value="">{bookId ? "Choose" : "Choose a book first"}</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.number}. {ch.nameEn}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
