import { useFormContext } from "react-hook-form";
import { useSubjects } from "~/lib/queries";
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
  const subjects = useSubjects();
  const { register, watch, setValue } = useFormContext<AskForm>();

  const subjectId = watch("subjectId");
  const bookId = watch("bookId");
  const books = subjects.find((s) => s.id === subjectId)?.books ?? [];
  const chapters = books.find((b) => b.id === bookId)?.chapters ?? [];

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
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameEn}
            </option>
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
