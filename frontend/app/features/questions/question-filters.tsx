import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import type { QuestionListFilters, Subject } from "~/lib/queries";
import { useSubjects } from "~/lib/queries";
import { STATUS_LABEL } from "~/lib/format";
import { FeedIndicator } from "./feed-indicator";

const STATUSES = [
  "waiting",
  "assigned",
  "answered",
  "satisfied",
  "unsatisfied",
] as const;

export function filtersFromParams(params: URLSearchParams): QuestionListFilters {
  return {
    subject: params.get("subject") ?? undefined,
    book: params.get("book") ?? undefined,
    chapter: params.get("chapter") ? Number(params.get("chapter")) : undefined,
    status: params.get("status") ?? undefined,
    q: params.get("q") ?? undefined,
    mine: params.get("mine") === "true" || undefined,
    limit: 20,
  };
}

/** Updates one query param, dropping any that depend on it. */
function useParamSetter() {
  const [params, setParams] = useSearchParams();
  const set = (key: string, value: string, clear: string[] = []) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    for (const k of clear) next.delete(k);
    setParams(next, { replace: true });
  };
  return [params, set] as const;
}

/**
 * Search box, the filter toggle and the filter panel. The taxonomy selects
 * suspend on their own boundary, so the search box is usable immediately.
 */
export function QuestionToolbar({
  taxonomySelects,
}: {
  /** The subject/book/chapter selects, wrapped in the caller's boundary. */
  taxonomySelects: React.ReactNode;
}) {
  const [params, setParam] = useParamSetter();
  const [open, setOpen] = useState(false);

  const status = params.get("status") ?? "";
  const active = ["subject", "book", "chapter", "status"].filter((k) =>
    params.get(k),
  ).length;

  return (
    <div className="qtools">
      <label className="field search-f">
        <span>Search question text</span>
        <span className="search">
          <Search size={16} aria-hidden="true" />
          <input
            className="input"
            type="search"
            placeholder="Search"
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => setParam("q", e.target.value)}
          />
        </span>
      </label>

      <button
        type="button"
        className="btn btn-ghost filters-toggle"
        aria-expanded={open}
        aria-controls="q-filters"
        onClick={() => setOpen((o) => !o)}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        Filters
        {active > 0 && (
          <span className="cnt" aria-label={`${active}`}>
            {active}
          </span>
        )}
      </button>

      <div className={`filters${open ? " open" : ""}`} id="q-filters">
        {taxonomySelects}

        <label className="field">
          <span>Status</span>
          <select
            className="select"
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

/** Placeholder selects with the same layout, shown while the tree loads. */
export function TaxonomySelectsPlaceholder() {
  return (
    <>
      {["Subject", "Book", "Chapter"].map((label) => (
        <label className="field" key={label}>
          <span>{label}</span>
          <select className="select" disabled>
            <option>Loading…</option>
          </select>
        </label>
      ))}
    </>
  );
}

/** Cascading subject → book → chapter selects. Suspends on the taxonomy. */
export function TaxonomySelects() {
  const subjects: Subject[] = useSubjects();
  const [params, setParam] = useParamSetter();

  const subject = params.get("subject") ?? "";
  const book = params.get("book") ?? "";
  const chapter = params.get("chapter") ?? "";

  const books = subjects.find((s) => s.id === subject)?.books ?? [];
  const chapters = books.find((b) => b.id === book)?.chapters ?? [];

  return (
    <>
      <label className="field">
        <span>Subject</span>
        <select
          className="select"
          value={subject}
          onChange={(e) => setParam("subject", e.target.value, ["book", "chapter"])}
        >
          <option value="">All subjects</option>
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
          value={book}
          disabled={!subject}
          onChange={(e) => setParam("book", e.target.value, ["chapter"])}
        >
          <option value="">{subject ? "All books" : "Choose a subject first"}</option>
          {books.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nameEn}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Chapter</span>
        <select
          className="select"
          value={chapter}
          disabled={!book}
          onChange={(e) => setParam("chapter", e.target.value)}
        >
          <option value="">{book ? "All chapters" : "Choose a book first"}</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={String(ch.id)}>
              {ch.number}. {ch.nameEn}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

/** The row between the filters and the list: live state, "mine", clear. */
export function ListMeta({ isStudent }: { isStudent: boolean }) {
  const [params, setParam] = useParamSetter();
  const mine = params.get("mine") === "true";
  const anyFilter = ["subject", "book", "chapter", "status", "q", "mine"].some(
    (k) => params.get(k),
  );

  return (
    <div className="list-meta">
      <FeedIndicator />
      <span style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        {isStudent && (
          <label className="check">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => setParam("mine", e.target.checked ? "true" : "")}
            />
            Only my questions
          </label>
        )}
        {anyFilter && (
          <Link className="btn btn-text" to="/questions">
            <RotateCcw size={14} />
            Clear filters
          </Link>
        )}
      </span>
    </div>
  );
}
