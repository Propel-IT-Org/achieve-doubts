import { Link } from "react-router";
import { ImageIcon } from "lucide-react";
import { StatusPill, Trace } from "~/components/primitives";
import { Skeleton } from "~/components/skeleton";
import { ago, clock, dur, shortName } from "~/lib/format";
import { type QuestionDetail, useQuestion } from "~/lib/queries";
import { useTaxonomy } from "~/lib/taxonomy";

/** The four captions under the big progress trace. */
function traceCaptions(question: QuestionDetail): string[] {
  const solution = question.solution ?? null;
  const assignedAt =
    question.matchedAfterSec != null
      ? new Date(question.askedAt).getTime() + question.matchedAfterSec * 1000
      : null;

  return [
    ago(question.askedAt),
    question.matchedAfterSec != null
      ? `after ${clock(question.matchedAfterSec)}`
      : "Waiting",
    solution && assignedAt
      ? `after ${dur((new Date(solution.createdAt).getTime() - assignedAt) / 60000)}`
      : "Not yet",
    question.status === "satisfied"
      ? "Satisfied"
      : question.status === "unsatisfied"
        ? "Not satisfied"
        : question.status === "answered"
          ? "Awaiting rating"
          : "Not yet",
  ];
}

/** The question itself: taxonomy, text, photo, progress and asker. */
export function QuestionHeader({ id }: { id: number }) {
  const question = useQuestion(id);
  const taxonomy = useTaxonomy();
  const chapterNo = taxonomy.chapterNumber(question.chapterId);

  return (
    <article className="qhead d-qhead" aria-labelledby="q-title">
      <div className="qc-bar">
        <span className="qc-subj">
          {/* The class first: it tells the solver what depth to answer at. */}
          {taxonomy.levelName(question.subjectId) && (
            <span className="qc-book">
              {taxonomy.levelName(question.subjectId)} ·{" "}
            </span>
          )}
          {taxonomy.subjectName(question.subjectId)}{" "}
          <span className="qc-book">/ {taxonomy.bookName(question.bookId)}</span>
        </span>
        <StatusPill status={question.status} />
      </div>

      <div className="qc-title">
        <span className="qc-num" aria-hidden="true">
          {chapterNo}
        </span>
        <div>
          <span className="qc-chlbl">
            Chapter<span className="sr"> {chapterNo}</span>
          </span>
          <h1 className="qc-chap" id="q-title" style={{ margin: 0, fontWeight: 400 }}>
            {taxonomy.chapterName(question.chapterId)}
          </h1>
        </div>
      </div>

      <p className="qtext">{question.text}</p>

      {question.photoUrl ? (
        <figure className="qphoto" style={{ margin: 0 }}>
          <img src={question.photoUrl} alt="Question attachment" />
          <figcaption>1 photo</figcaption>
        </figure>
      ) : (
        <span className="nophoto">
          <ImageIcon size={16} aria-hidden="true" />
          No photo attached
        </span>
      )}

      <Trace status={question.status} big subs={traceCaptions(question)} />

      <div className="qc-foot q-by">
        {question.asker && (
          <span>
            Asked by{" "}
            <Link className="linkish" to={`/students/${question.asker.id}`}>
              {shortName(question.asker.name)}
            </Link>
          </span>
        )}
        <span>{ago(question.askedAt)}</span>
      </div>
    </article>
  );
}

export function QuestionHeaderSkeleton() {
  return (
    <div className="qhead d-qhead" aria-busy="true" style={{ display: "grid", gap: 14 }}>
      <Skeleton width="45%" />
      <Skeleton height={40} width="70%" />
      <Skeleton height={90} />
      <Skeleton height={48} />
    </div>
  );
}
