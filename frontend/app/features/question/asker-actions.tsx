import { useQuestion } from "~/lib/queries";
import { useSession } from "~/lib/session";
import { RatingSection } from "./rating-section";
import { ReportBox } from "./report-box";

const ANSWERED = ["answered", "satisfied", "unsatisfied"];

/** Rating and reporting — shown to the asker once their question is answered. */
export function AskerActions({ id }: { id: number }) {
  const question = useQuestion(id);
  const { user } = useSession();

  if (!user || user.id !== question.askerId) return null;

  return (
    <>
      {ANSWERED.includes(question.status) && (
        <RatingSection id={id} status={question.status} />
      )}
      {question.solution && <ReportBox id={id} />}
    </>
  );
}
