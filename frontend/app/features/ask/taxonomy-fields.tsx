import { useFormContext } from "react-hook-form";
import { textbooksFor, useSubjects } from "~/lib/queries";
import type { AskForm } from "./ask-schema";

/** Disabled stand-ins with the same layout, while the tree loads. */
export function TaxonomyFieldsPlaceholder() {
  return (
    <>
      <div className="ask-grid">
        {["Subject", "Paper", "Chapter"].map((label) => (
          <label className="field" key={label}>
            <span>{label}</span>
            <select className="select" disabled>
              <option>Loading…</option>
            </select>
          </label>
        ))}
      </div>
      <label className="field">
        <span>Book</span>
        <select className="select" disabled>
          <option>Loading…</option>
        </select>
      </label>
    </>
  );
}

/**
 * Cascading subject → paper → chapter selects, then the textbook the
 * problem came from (optional; only the books for that subject and paper).
 * Suspends on the taxonomy.
 */
export function TaxonomyFields() {
  const subjects = useSubjects();
  const { register, watch, setValue } = useFormContext<AskForm>();

  const subjectId = watch("subjectId");
  const bookId = watch("bookId");
  const subject = subjects.find((s) => s.id === subjectId);
  const books = subject?.books ?? [];
  const chapters = books.find((b) => b.id === bookId)?.chapters ?? [];
  const textbooks = bookId ? textbooksFor(subject, bookId) : [];

  return (
    <>
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
              setValue("textbookId", "");
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
          <span>Paper</span>
          <select
            className="select"
            disabled={!subjectId}
            {...register("bookId")}
            onChange={(e) => {
              setValue("bookId", e.target.value);
              setValue("chapterId", 0);
              // Biology's books are per paper: a Botany book can't stay
              // chosen for a Zoology question.
              if (!textbooksFor(subject, e.target.value).some((t) => t.id === watch("textbookId"))) {
                setValue("textbookId", "");
              }
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
            <option value="">{bookId ? "Choose" : "Choose a paper first"}</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.number}. {ch.nameEn}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Book</span>
        <select className="select" disabled={!bookId} {...register("textbookId")}>
          <option value="">{bookId ? "Not listed / another book" : "Choose a paper first"}</option>
          {textbooks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nameEn}
            </option>
          ))}
        </select>
        <small>Optional. Which book the problem is from, if it's one of these.</small>
      </label>
    </>
  );
}
