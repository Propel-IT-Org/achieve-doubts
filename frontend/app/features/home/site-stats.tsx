import { dur, fmt, pct } from "~/lib/format";
import { useHomeStats } from "~/lib/queries";

/** The four headline figures under the hero. */
export function StatsFigures() {
  const data = useHomeStats();

  return (
    <div className="stats4">
      <div className="stat">
        <div className="v">{fmt(data.solved)}</div>
        <div className="l">questions solved so far</div>
      </div>
      <div className="stat">
        <div className="v">
          {data.medianMatchSeconds != null
            ? `${Math.round(data.medianMatchSeconds)} s`
            : "–"}
        </div>
        <div className="l">typical wait until a solver takes your question</div>
      </div>
      <div className="stat">
        <div className="v">{dur(data.medianAnswerMinutes)}</div>
        <div className="l">typical time to a full answer</div>
      </div>
      <div className="stat">
        <div className="v">{pct(data.satisfactionRate)}</div>
        <div className="l">of answers marked satisfied</div>
      </div>
    </div>
  );
}

/** "N solvers available now", beside the hero buttons. */
export function OnlineCount() {
  const data = useHomeStats();
  return <>{data.solversAvailable} solvers available now</>;
}
