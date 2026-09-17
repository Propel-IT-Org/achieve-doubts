import { useMemo } from "react";
import { Link } from "react-router";
import { AlertTriangle } from "lucide-react";
import { mutate as mutateKey } from "swr";
import { ApiError } from "~/lib/api";
import { QuestionCard } from "~/components/question-card";
import { CardsSkeleton } from "~/components/skeleton";
import {
  fetchQuestion,
  fetchQuestions,
  type QuestionListFilters,
  type QuestionPage,
  type QuestionRow,
  useQuestionsInfinite,
} from "~/lib/queries";
import { type FeedEvent, runSoon, useFeedEvent } from "~/lib/realtime";
import { useTaxonomy } from "~/lib/taxonomy";

/** Events that change a card's status, or remove it. */
const CARD_EVENTS = new Set<FeedEvent>([
  "QUESTION_LOCKED",
  "QUESTION_UNLOCKED",
  "QUESTION_OVERRIDDEN",
  "QUESTION_EXPIRED",
  "QUESTION_ANSWERED",
  "QUESTION_RATED",
  "QUESTION_DELETED",
  "SOLUTION_DELETED",
]);

/** The list-row fields of a question, from whatever shape the API sent. */
function toRow(q: QuestionRow): QuestionRow {
  return {
    id: q.id,
    askerId: q.askerId,
    subjectId: q.subjectId,
    bookId: q.bookId,
    chapterId: q.chapterId,
    text: q.text,
    photoUrl: q.photoUrl,
    status: q.status,
    solverId: q.solverId,
    matchedAfterSec: q.matchedAfterSec,
    askedAt: q.askedAt,
    answeredAt: q.answeredAt,
  };
}

/**
 * The question list. The API supplies what already exists; the live feed
 * (signed-in users only — see routes/questions.tsx) adds to it:
 *
 *   - a new question: re-read the newest page with these same filters, and
 *     put whatever isn't shown yet on top. The server decides whether it
 *     matches the filters, and the later pages' cursors are untouched.
 *   - a change to a question on screen: re-read that one question and
 *     update its card, or drop the card if it no longer matches the status
 *     filter (a solver browsing open questions sees a locked one leave).
 *
 * Events about questions that aren't on screen cost nothing.
 */
export function QuestionFeed({ filters }: { filters: QuestionListFilters }) {
  const taxonomy = useTaxonomy();
  const { items, hasMore, loadMore, isLoadingMore, isLoadingInitial, error, mutate } =
    useQuestionsInfinite(filters);

  const loadedIds = useMemo(() => new Set(items.map((q) => q.id)), [items]);
  const listId = JSON.stringify(filters);

  /**
   * Rewrites the loaded pages in place. Each page is also written back to
   * its own cache entry: "load more" rebuilds the list from those, and would
   * otherwise bring back the pre-edit pages. Cursors never change here —
   * adding to or removing from a page leaves the next page's keyset valid.
   */
  const editPages = async (edit: (pages: QuestionPage[]) => QuestionPage[]) => {
    const pages = await mutate((current) => current && edit(current), {
      revalidate: false,
    });
    pages?.forEach((page, i) => {
      const cursor = i === 0 ? null : (pages[i - 1]?.nextCursor ?? null);
      void mutateKey(["questions-infinite", filters, cursor], page, {
        revalidate: false,
      });
    });
  };

  const addNewest = async () => {
    const newest = await fetchQuestions(filters);
    await editPages((pages) => {
      const [first, ...rest] = pages;
      if (!first) return pages;
      const shown = new Set(pages.flatMap((p) => p.items.map((q) => q.id)));
      const fresh = newest.items.filter((q) => !shown.has(q.id));
      if (!fresh.length) return pages;
      return [{ ...first, items: [...fresh, ...first.items] }, ...rest];
    });
  };

  const refreshCard = async (id: number) => {
    let updated: QuestionRow | null;
    try {
      updated = toRow(await fetchQuestion(id));
    } catch (err) {
      // Deleted: the card goes. Anything else: leave the list as it is.
      if (!(err instanceof ApiError && err.status === 404)) return;
      updated = null;
    }
    const replacement =
      updated && (!filters.status || updated.status === filters.status)
        ? [updated]
        : [];
    await editPages((pages) =>
      pages.map((page) => ({
        ...page,
        items: page.items.flatMap((q) => (q.id === id ? replacement : [q])),
      })),
    );
  };

  useFeedEvent(({ event, data }) => {
    if (event === "QUESTION_CREATED") {
      runSoon(`new:${listId}`, addNewest);
    } else if (CARD_EVENTS.has(event) && loadedIds.has(data.questionId)) {
      runSoon(`card:${listId}:${data.questionId}`, () => refreshCard(data.questionId));
    }
  });

  if (error) {
    return (
      <div className="err" role="alert">
        <AlertTriangle size={16} />
        {error instanceof Error ? error.message : "Couldn't load questions."}
      </div>
    );
  }

  if (isLoadingInitial) return <CardsSkeleton />;

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
          <QuestionCard key={question.id} question={question} taxonomy={taxonomy} />
        ))}
      </div>

      {hasMore && (
        <div className="cta" style={{ justifyContent: "center", marginTop: 24 }}>
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
