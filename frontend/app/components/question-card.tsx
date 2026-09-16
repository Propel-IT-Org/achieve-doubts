import { Link } from "react-router";
import type { QuestionRow, Subject } from "~/lib/queries";
import { ago, shortName } from "~/lib/format";
import { StatusPill, Trace } from "./primitives";

export type TaxonomyLookup = {
  subjectName: (id: string) => string;
  bookName: (id: string) => string;
  chapterName: (id: number) => string;
  chapterNumber: (id: number) => number;
};

/**
 * Builds the id -> display-name lookups the cards need, from the taxonomy
 * tree the API returns. Kept outside the card so a list renders one lookup
 * rather than one per row.
 */
export function buildTaxonomyLookup(subjects: Subject[]): TaxonomyLookup {
  const subjectNames = new Map<string, string>();
  const bookNames = new Map<string, string>();
  const chapterNames = new Map<number, string>();
  const chapterNumbers = new Map<number, number>();

  for (const subject of subjects) {
    subjectNames.set(subject.id, subject.nameEn);
    for (const book of subject.books) {
      bookNames.set(book.id, book.nameEn);
      for (const chapter of book.chapters) {
        chapterNames.set(chapter.id, chapter.nameEn);
        chapterNumbers.set(chapter.id, chapter.number);
      }
    }
  }

  return {
    subjectName: (id) => subjectNames.get(id) ?? id,
    bookName: (id) => bookNames.get(id) ?? id,
    chapterName: (id) => chapterNames.get(id) ?? "",
    chapterNumber: (id) => chapterNumbers.get(id) ?? 0,
  };
}

export function QuestionCard({
  question,
  taxonomy,
  compact,
  askerName,
  solverName,
  commentCount,
  statusOverride,
}: {
  question: QuestionRow;
  taxonomy: TaxonomyLookup;
  compact?: boolean;
  askerName?: string;
  solverName?: string;
  commentCount?: number;
  statusOverride?: string;
}) {
  const status = statusOverride ?? question.status;
  const chapterNo = taxonomy.chapterNumber(question.chapterId);

  return (
    <Link to={`/questions/${question.id}`} className={`qc${compact ? " compact" : ""}`}>
      <div className="qc-bar">
        <span className="qc-subj">
          {taxonomy.subjectName(question.subjectId)}{" "}
          <span className="qc-book">/ {taxonomy.bookName(question.bookId)}</span>
        </span>
        <StatusPill status={status} />
      </div>

      <div className="qc-title">
        <span className="qc-num" aria-hidden="true">
          {chapterNo}
        </span>
        <div>
          <span className="qc-chlbl">
            Chapter<span className="sr"> {chapterNo}</span>
          </span>
          <div className="qc-chap">{taxonomy.chapterName(question.chapterId)}</div>
        </div>
      </div>

      <div className="qc-body">
        <p className="qc-q">{question.text}</p>
        {question.photoUrl && (
          <span className="qc-photo">
            <img className="qc-thumb" src={question.photoUrl} alt="1 photo" />
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
        {askerName && (
          <span>
            Asked by <b>{shortName(askerName)}</b>
          </span>
        )}
        {status !== "waiting" && solverName && (
          <span>
            Solver <b>{shortName(solverName)}</b>
          </span>
        )}
        <span>{ago(question.askedAt)}</span>
        {commentCount !== undefined && (
          <span>
            {commentCount === 0
              ? "No comments yet"
              : commentCount === 1
                ? "1 comment"
                : `${commentCount} comments`}
          </span>
        )}
      </div>
    </Link>
  );
}
