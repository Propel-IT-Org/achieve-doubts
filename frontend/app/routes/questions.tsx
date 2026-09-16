import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { AlertTriangle, Lock, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import useSWR, { preload } from "swr";

import type { Route } from "./+types/questions";
import {
  fetchQuestions,
  fetchSubjects,
  subjectsKey,
  swrConfig,
  useQuestionsInfinite,
  type QuestionListFilters,
} from "~/lib/queries";
import { useFeedSubscription } from "~/lib/realtime";
import { isSolver, useSession } from "~/lib/session";
import { buildTaxonomyLookup, QuestionCard } from "~/components/question-card";

const STATUSES = [
  "waiting",
  "assigned",
  "answered",
  "satisfied",
  "unsatisfied",
] as const;

const STATUS_LABEL: Record<string, string> = {
  waiting: "Open",
  assigned: "Solver assigned",
  answered: "Answered",
  satisfied: "Solved",
  unsatisfied: "Not satisfied",
};

export function meta(_: Route.MetaArgs) {
  return [{ title: "Questions — Achieve Doubts" }];
}

function filtersFromParams(params: URLSearchParams): QuestionListFilters {
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

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const url = new URL(request.url);
  const filters = filtersFromParams(url.searchParams);
  preload(subjectsKey(), fetchSubjects);
  // useSWRInfinite stores each page under its own key, so priming page 0 here
  // is what makes the first paint immediate. `null` is the page-0 cursor.
  preload(["questions-infinite", filters, null], () => fetchQuestions(filters));
  return null;
}

function QuestionList({ filters }: { filters: QuestionListFilters }) {
  const { items, hasMore, loadMore, isLoadingMore, isLoadingInitial, error } =
    useQuestionsInfinite(filters);
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects, swrConfig);

  const taxonomy = useMemo(
    () => buildTaxonomyLookup(subjects ?? []),
    [subjects],
  );

  if (error) {
    return (
      <div className="err" role="alert">
        <AlertTriangle size={16} />
        {error instanceof Error ? error.message : "Couldn't load questions."}
      </div>
    );
  }

  if (isLoadingInitial) {
    return (
      <p className="muted" style={{ margin: 0 }} aria-live="polite">
        Loading questions…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="empty">
        <h3>No questions match these filters.</h3>
        <p>Clear a filter, or ask this question yourself.</p>
        <div className="cta" style={{ justifyContent: "center" }}>
          <Link className="btn btn-ghost" to="/questions">
            Clear filters
          </Link>
          <Link className="btn btn-primary" to="/ask">
            Ask a question
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="cards">
        {items.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            taxonomy={taxonomy}
          />
        ))}
      </div>

      {hasMore && (
        <div
          className="cta"
          style={{ justifyContent: "center", marginTop: 24 }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => loadMore()}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading…" : "Load more questions"}
          </button>
        </div>
      )}
    </>
  );
}

export default function QuestionsPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useSession();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = filtersFromParams(params);
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects, swrConfig);

  // Solvers race each other for locks, so their list has to stay live. The
  // endpoint requires the solver claim permission, so nobody else subscribes.
  useFeedSubscription(isSolver(user?.role));

  const subject = params.get("subject") ?? "";
  const book = params.get("book") ?? "";
  const chapter = params.get("chapter") ?? "";
  const status = params.get("status") ?? "";
  const query = params.get("q") ?? "";
  const mine = params.get("mine") === "true";

  const books = subjects?.find((s) => s.id === subject)?.books ?? [];
  const chapters = books.find((b) => b.id === book)?.chapters ?? [];

  const setParam = (key: string, value: string, clear: string[] = []) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    for (const k of clear) next.delete(k);
    setParams(next, { replace: true });
  };

  const activeFilters = [subject, book, chapter, status].filter(Boolean).length;
  const anyFilter = Boolean(
    subject || book || chapter || status || query || mine,
  );

  return (
    <main id="main" className="page">
      <div className="wrap">
        <div className="ph">
          <h1>Questions</h1>
          <p>Every question, newest first. Open one to read the full thread.</p>
        </div>

        {isSolver(user?.role) && (
          <div className="solver-hint">
            <Lock size={18} aria-hidden="true" />
            <span>
              Open a question to lock it. While it's locked, only you can answer.
              You can unlock it from the same page if you decide to skip it.
            </span>
          </div>
        )}

        <div className="qtools">
          <label className="field search-f">
            <span>Search question text</span>
            <span className="search">
              <Search size={16} aria-hidden="true" />
              <input
                className="input"
                type="search"
                placeholder="Search"
                defaultValue={query}
                onChange={(e) => setParam("q", e.target.value)}
              />
            </span>
          </label>

          <button
            type="button"
            className="btn btn-ghost filters-toggle"
            aria-expanded={filtersOpen}
            aria-controls="q-filters"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <SlidersHorizontal size={16} aria-hidden="true" />
            Filters
            {activeFilters > 0 && (
              <span className="cnt" aria-label={`${activeFilters}`}>
                {activeFilters}
              </span>
            )}
          </button>

          <div className={`filters${filtersOpen ? " open" : ""}`} id="q-filters">
            <label className="field">
              <span>Subject</span>
              <select
                className="select"
                value={subject}
                onChange={(e) => setParam("subject", e.target.value, ["book", "chapter"])}
              >
                <option value="">All subjects</option>
                {subjects?.map((s) => (
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
                <option value="">
                  {subject ? "All books" : "Choose a subject first"}
                </option>
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

        <div className="list-meta">
          <span aria-live="polite" />
          <span style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            {user?.role === "student" && (
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

        <QuestionList filters={filters} />
      </div>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <main id="main" className="page">
      <div className="wrap">
        <div className="err" role="alert">
          <AlertTriangle size={16} />
          Couldn't load questions. Check that the API is running, then retry.
        </div>
      </div>
    </main>
  );
}
