import { AlertTriangle } from "lucide-react";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { type SortAccessors, SortHeader, useSortedRows } from "~/components/table-sort";
import { dur, fmt, share } from "~/lib/format";
import { type LockActivity, type RangeFilters, useLockActivity } from "~/lib/queries";
import { MAIN_SITE_URL } from "~/lib/taxonomy";

type SolverLocks = LockActivity["perSolver"][number];

const LOCK_SORTS: SortAccessors<SolverLocks> = {
  name: (s) => s.name,
  locks: (s) => s.locks,
  answered: (s) => s.answered,
  unlocked: (s) => s.unlocked,
  expired: (s) => (s.locks ? s.expired / s.locks : null),
  takenOver: (s) => s.takenOver,
  peak: (s) => s.peakHeld,
  multi: (s) => s.multiMinutes,
};

/**
 * How solvers hold questions, for spotting hoarding: holding several at
 * once, or locking questions and letting the locks run out. A solver may
 * hold one question at a time; a peak above one means they did so before
 * that rule existed, or are still holding them (the live list).
 */
export function LockActivitySection({ filters }: { filters: RangeFilters }) {
  return (
    <section style={{ marginTop: 36 }} aria-labelledby="locks-h">
      <div className="section-h">
        <div>
          <h2 className="h3" id="locks-h">
            Lock activity
          </h2>
          <p style={{ maxWidth: "46em" }}>
            A solver may hold one question at a time. Holding several, or letting
            locks expire unanswered, keeps questions away from everyone else.
            Uses the date range and solver above.
          </p>
        </div>
      </div>
      <AsyncBoundary fallback={<PanelSkeleton lines={5} />} errorText="Couldn't load lock activity.">
        <LockActivityReport filters={filters} />
      </AsyncBoundary>
    </section>
  );
}

function LockActivityReport({ filters }: { filters: RangeFilters }) {
  const { perSolver, current } = useLockActivity(filters);
  const { rows, headerProps } = useSortedRows(perSolver, LOCK_SORTS);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {current.length > 0 && (
        <div className="callout warn" role="status">
          <AlertTriangle size={20} />
          <div>
            <h3>
              {current.length === 1
                ? "1 solver is holding more than one question right now"
                : `${current.length} solvers are holding more than one question right now`}
            </h3>
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {current.map((holder) => (
                <li key={holder.solverId}>
                  <b>{holder.name}</b>:{" "}
                  {holder.questionIds.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ", "}
                      <a href={`${MAIN_SITE_URL}/questions/${id}`} target="_blank" rel="noreferrer">
                        #{id}
                      </a>
                    </span>
                  ))}
                </li>
              ))}
            </ul>
            <p style={{ margin: "6px 0 0" }}>
              They can't lock anything new. These locks expire on their own, or an
              admin solver can take one over from its question page.
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">
          <p style={{ margin: 0 }}>No questions were locked in this range.</p>
        </div>
      ) : (
        <div className="table-wrap stack-wrap">
          <table className="tbl stack wide" style={{ minWidth: 900 }}>
            <caption className="sr">Lock activity per solver</caption>
            <thead>
              <tr>
                <SortHeader label="Solver" {...headerProps("name")} />
                <SortHeader label="Locks" numeric {...headerProps("locks", "desc")} />
                <SortHeader label="Answered" numeric {...headerProps("answered", "desc")} />
                <SortHeader label="Unlocked" numeric {...headerProps("unlocked", "desc")} />
                <SortHeader label="Expired" numeric {...headerProps("expired", "desc")} />
                <SortHeader label="Taken over" numeric {...headerProps("takenOver", "desc")} />
                <SortHeader label="Most held at once" numeric {...headerProps("peak", "desc")} />
                <SortHeader label="Time holding 2+" numeric {...headerProps("multi", "desc")} />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.solverId}>
                  <td className="lead">
                    <b>{s.name}</b>{" "}
                    {s.peakHeld > 1 && <span className="tag warn">Held {s.peakHeld} at once</span>}
                  </td>
                  <td className="num" data-label="Locks">
                    {fmt(s.locks)}
                  </td>
                  <td className="num" data-label="Answered">
                    {fmt(s.answered)}
                  </td>
                  <td className="num" data-label="Unlocked">
                    {fmt(s.unlocked)}
                  </td>
                  <td className="num" data-label="Expired">
                    {fmt(s.expired)}
                    {s.expired > 0 && (
                      <span className="muted"> ({share(s.expired, s.locks)})</span>
                    )}
                  </td>
                  <td className="num" data-label="Taken over">
                    {fmt(s.takenOver)}
                  </td>
                  <td className="num" data-label="Most held at once">
                    {fmt(s.peakHeld)}
                  </td>
                  <td className="num" data-label="Time holding 2+">
                    {s.multiMinutes > 0 ? dur(s.multiMinutes) : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
