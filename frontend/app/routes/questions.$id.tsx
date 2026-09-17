import { Link, useParams } from "react-router";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/questions.$id";
import {
  commentsKey,
  fetchComments,
  fetchQuestion,
  fetchSubjects,
  questionKey,
  subjectsKey,
} from "~/lib/queries";
import { isAdminSolver, isSolver, useSession } from "~/lib/session";
import { AsyncBoundary } from "~/components/async-boundary";
import { Gate } from "~/components/primitives";
import { AdminTools } from "~/features/question/admin-tools";
import { AskerActions } from "~/features/question/asker-actions";
import { CommentsSection } from "~/features/question/comments-section";
import {
  QuestionHeader,
  QuestionHeaderSkeleton,
} from "~/features/question/question-header";
import { SolutionSection } from "~/features/question/solution-section";
import { SolvePanel } from "~/features/question/solve-panel";
import { ThreadSection } from "~/features/question/thread-section";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Question — Achieve Doubts" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const id = Number(params.id);
  // All three start now, in parallel; each section shows as its own lands.
  preload(subjectsKey(), fetchSubjects);
  preload(questionKey(id), () => fetchQuestion(id));
  preload(commentsKey(id), () => fetchComments(id));
  return null;
}

/**
 * Layout only. Every section reads its own data under its own boundary, and
 * the live feed keeps them current: a lock, answer, rating, follow-up or
 * comment by someone else shows up here without a reload.
 */
export default function QuestionPage() {
  const id = Number(useParams().id);
  const { user } = useSession();
  const solver = isSolver(user?.role);

  return (
    <main id="main" className="page">
      <div className={`wrap${solver ? "" : " narrow"}`}>
        <Link to="/questions" className="back">
          <ChevronLeft size={16} />
          Back to questions
        </Link>

        <div className={`detail${solver ? "" : " no-side"}`}>
          <div className="d-main">
            <AsyncBoundary
              fallback={<QuestionHeaderSkeleton />}
              errorText="This question doesn't exist or was removed."
            >
              <QuestionHeader id={id} />
            </AsyncBoundary>

            <div className="d-body">
              <SolutionSection id={id} />
              <AsyncBoundary fallback={null}>
                <AskerActions id={id} />
              </AsyncBoundary>
              <ThreadSection id={id} />
              <CommentsSection id={id} />
            </div>
          </div>

          <div className="aside">
            <div className="d-actions">
              {solver && <SolvePanel id={id} />}
              {isAdminSolver(user?.role) && <AdminTools id={id} />}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function ErrorBoundary() {
  return (
    <main id="main" className="page">
      <div className="wrap">
        <Gate icon={<AlertTriangle size={24} />} title="This question doesn't exist or was removed.">
          <Link className="btn btn-primary" to="/questions">
            Back to questions
          </Link>
        </Gate>
      </div>
    </main>
  );
}
