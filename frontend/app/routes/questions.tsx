import { useSearchParams } from "react-router";
import { AlertTriangle, Lock } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/questions";
import { fetchQuestions, fetchTaxonomy, taxonomyKey } from "~/lib/queries";
import { useLiveFeed } from "~/lib/realtime";
import { isSolver, useSession } from "~/lib/session";
import { AsyncBoundary } from "~/components/async-boundary";
import { CardsSkeleton } from "~/components/skeleton";
import {
  filtersFromParams,
  ListMeta,
  QuestionToolbar,
  TaxonomySelects,
  TaxonomySelectsPlaceholder,
} from "~/features/questions/question-filters";
import { QuestionFeed } from "~/features/questions/question-feed";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Questions — Achieve Doubts" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const filters = filtersFromParams(new URL(request.url).searchParams);
  preload(taxonomyKey(), fetchTaxonomy);
  // useSWRInfinite stores each page under its own key; `null` is page 0's
  // cursor, so this is the exact key the list reads first.
  preload(["questions-infinite", filters, null], () => fetchQuestions(filters));
  return null;
}

export default function QuestionsPage() {
  const [params] = useSearchParams();
  const { user } = useSession();

  // Signed-in users get the live feed while they're on this page: the list
  // loads from the API, then new questions and status changes stream in.
  useLiveFeed(user?.id);

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
              Open a question to lock it. While it's locked, only you can
              answer. You can unlock it from the same page if you decide to skip
              it.
            </span>
          </div>
        )}

        <QuestionToolbar
          taxonomySelects={
            <AsyncBoundary
              fallback={<TaxonomySelectsPlaceholder />}
              errorText="Couldn't load subjects."
            >
              <TaxonomySelects />
            </AsyncBoundary>
          }
        />

        <ListMeta isStudent={user?.role === "student"} />

        <AsyncBoundary
          fallback={<CardsSkeleton />}
          errorText="Couldn't load questions. Check that the API is running, then retry."
        >
          <QuestionFeed filters={filtersFromParams(params)} />
        </AsyncBoundary>
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
