import { useRateQuestion } from "~/lib/mutations";
import { useAction } from "./use-action";

export function RatingSection({ id, status }: { id: number; status: string }) {
  const rate = useRateQuestion(id);
  const run = useAction();

  const set = (value: "satisfied" | "unsatisfied") =>
    run(() => rate.trigger({ value }), "Rating saved");

  return (
    <section className="section panel" aria-labelledby="rate-h">
      <h2 className="h3" id="rate-h">
        Did this answer clear your doubt?
      </h2>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        Your rating is shown on the question and counts toward the solver's
        record. You can change it later.
      </p>
      <div className="rate">
        <button
          type="button"
          className="yes"
          aria-pressed={status === "satisfied"}
          disabled={rate.isMutating}
          onClick={() => set("satisfied")}
        >
          <i aria-hidden="true" />
          Satisfied
        </button>
        <button
          type="button"
          className="no"
          aria-pressed={status === "unsatisfied"}
          disabled={rate.isMutating}
          onClick={() => set("unsatisfied")}
        >
          <i aria-hidden="true" />
          Not satisfied
        </button>
      </div>
    </section>
  );
}
