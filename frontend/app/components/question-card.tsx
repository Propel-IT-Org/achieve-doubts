import type { ReactNode } from "react";
import { Link } from "react-router";
import type { QuestionRow } from "~/lib/queries";
import type { TaxonomyLookup } from "~/lib/taxonomy";
import { ago, shortName } from "~/lib/format";
import { StatusPill, Trace } from "./primitives";

export type QuestionCardViewProps = {
  to: string;
  status: string;
  subjectName: string;
  bookName: string;
  chapterNumber: number;
  chapterName: string;
  text: string;
  /** The thumbnail, already rendered — an <img> or the demo's sketch. */
  photo?: ReactNode;
  askerName?: string;
  /** "Rafid H., BUET Mechanical ’24" — name first, credentials after. */
  solverName?: string;
  solverCredentials?: string;
  when: string;
  commentCount?: number;
  compact?: boolean;
};

/** The prototype's `.qc` card, fed display values only. */
export function QuestionCardView(props: QuestionCardViewProps) {
  const { status } = props;

  return (
    <Link to={props.to} className={`qc${props.compact ? " compact" : ""}`}>
      <div className="qc-bar">
        <span className="qc-subj">
          {props.subjectName}{" "}
          <span className="qc-book">/ {props.bookName}</span>
        </span>
        <StatusPill status={status} />
      </div>

      <div className="qc-title">
        <span className="qc-num" aria-hidden="true">
          {props.chapterNumber}
        </span>
        <div>
          <span className="qc-chlbl">
            Chapter<span className="sr"> {props.chapterNumber}</span>
          </span>
          <div className="qc-chap">{props.chapterName}</div>
        </div>
      </div>

      <div className="qc-body">
        <p className="qc-q">{props.text}</p>
        {props.photo && (
          <span className="qc-photo">
            {props.photo}
            <span className="qc-photo-n" aria-hidden="true">
              1 photo
            </span>
          </span>
        )}
      </div>

      <div className="qc-trace" aria-hidden="true">
        <Trace status={status} />
      </div>

      <div className="qc-foot">
        {props.askerName && (
          <span>
            Asked by <b>{shortName(props.askerName)}</b>
          </span>
        )}
        {status !== "waiting" && props.solverName && (
          <span>
            Solver <b>{shortName(props.solverName)}</b>
            {props.solverCredentials && `, ${props.solverCredentials}`}
          </span>
        )}
        <span>{props.when}</span>
        {props.commentCount !== undefined && (
          <span>
            {props.commentCount === 0
              ? "No comments yet"
              : props.commentCount === 1
                ? "1 comment"
                : `${props.commentCount} comments`}
          </span>
        )}
      </div>
    </Link>
  );
}

/** A live question from the API. */
export function QuestionCard({
  question,
  taxonomy,
  compact,
}: {
  question: QuestionRow;
  taxonomy: TaxonomyLookup;
  compact?: boolean;
}) {
  return (
    <QuestionCardView
      to={`/questions/${question.id}`}
      status={question.status}
      subjectName={taxonomy.subjectName(question.subjectId)}
      bookName={taxonomy.bookName(question.bookId)}
      chapterNumber={taxonomy.chapterNumber(question.chapterId)}
      chapterName={taxonomy.chapterName(question.chapterId)}
      text={question.text}
      photo={
        question.photoUrl && (
          <img className="qc-thumb" src={question.photoUrl} alt="1 photo" />
        )
      }
      when={ago(question.askedAt)}
      compact={compact}
    />
  );
}

/** A grid of question cards, or the given empty state. */
export function QuestionGrid({
  questions,
  taxonomy,
  empty,
}: {
  questions: QuestionRow[];
  taxonomy: TaxonomyLookup;
  empty: string;
}) {
  if (!questions.length) {
    return (
      <div className="empty" style={{ marginTop: 16 }}>
        <p style={{ margin: 0 }}>{empty}</p>
      </div>
    );
  }
  return (
    <div className="cards" style={{ marginTop: 16 }}>
      {questions.map((q) => (
        <QuestionCard key={q.id} question={q} taxonomy={taxonomy} compact />
      ))}
    </div>
  );
}
