import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton, Skeleton } from "~/components/skeleton";
import { dur, share } from "~/lib/format";
import { type RankedSolver, type RankingFilters, useRankings } from "~/lib/queries";
import { useDebounced } from "~/lib/use-debounced";

type Range = Omit<RankingFilters, "minAnswered">;

/**
 * Solver highlights and the best/worst satisfaction tables. Uses the page's
 * date range and subject, but not its solver filter — ranking one solver
 * against nobody says nothing.
 */
export function SolverRankings({ range }: { range: Range }) {
  const [minInput, setMinInput] = useState("20");
  const valid = /^\d+$/.test(minInput.trim()) && Number(minInput) >= 1;
  // A typed "150" shouldn't fetch for 1 and 15 on the way.
  const minAnswered = useDebounced(valid ? Number(minInput) : 1, 400);
  const filters = { ...range, minAnswered };

  return (
    <section style={{ marginTop: 36 }} aria-labelledby="hl-h">
      <h2 className="h3" id="hl-h">
        Solver highlights
      </h2>
      <AsyncBoundary
        fallback={<Skeleton height={110} radius={16} style={{ marginBottom: 32 }} />}
        errorText="Couldn't load solver highlights."
      >
        <Highlights filters={filters} />
      </AsyncBoundary>

      <div className="section-h" style={{ alignItems: "flex-end" }}>
        <div>
          <h2 className="h3">Best and worst solvers by satisfaction</h2>
          <p style={{ maxWidth: "46em" }}>
            Uses the date range and subject above. Only solvers with at least the
            minimum number of answered questions are ranked.
          </p>
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          <label className="field" style={{ width: 220 }}>
            <span>Minimum answered questions</span>
            <input
              className="input"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={minInput}
              aria-invalid={valid ? undefined : "true"}
              aria-describedby="min-msg"
              onChange={(e) => setMinInput(e.target.value)}
            />
          </label>
          <span id="min-msg" style={{ fontSize: 13 }} aria-live="polite">
            {valid ? (
              <AsyncBoundary fallback={null} errorFallback={null}>
                <EligibleCount filters={filters} />
              </AsyncBoundary>
            ) : (
              <span className="field-err">
                <AlertTriangle size={13} />
                Enter a whole number of 1 or more.
              </span>
            )}
          </span>
        </div>
      </div>

      <AsyncBoundary fallback={<PanelSkeleton lines={5} />} errorText="Couldn't load the rankings.">
        <RankingTables filters={filters} />
      </AsyncBoundary>
    </section>
  );
}

function Highlights({ filters }: { filters: RankingFilters }) {
  const { mostAnswered, highestSatisfaction: best, fastest } = useRankings(filters);

  const card = (label: string, solver: RankedSolver | null, detail: (s: RankedSolver) => string) => (
    <div className="metric">
      <div className="l">{label}</div>
      <div className="v" style={{ fontSize: 26, marginTop: 6 }}>
        {solver ? solver.name : "No solver qualifies"}
      </div>
      {solver && <div className="s">{detail(solver)}</div>}
    </div>
  );

  return (
    <div className="metrics" style={{ "--cols": 3, marginBottom: 32 } as React.CSSProperties}>
      {card("Most questions answered", mostAnswered, (s) => `${s.answered} answered`)}
      {card(
        "Highest satisfaction",
        best,
        (s) => `${share(s.satisfied, s.satisfied + s.unsatisfied)} satisfied, ${s.answered} answered`,
      )}
      {card(
        "Fastest average response",
        fastest,
        (s) => `${dur(s.avgResponseMinutes)} on average, ${s.answered} answered`,
      )}
    </div>
  );
}

function EligibleCount({ filters }: { filters: RankingFilters }) {
  const { eligibleCount, rankedCount } = useRankings(filters);
  return (
    <span className="muted">
      {eligibleCount} of {rankedCount} solvers qualify
    </span>
  );
}

function RankingTables({ filters }: { filters: RankingFilters }) {
  const { best, worst } = useRankings(filters);

  if (best.length === 0) {
    return (
      <div className="empty">
        <p style={{ margin: 0 }}>
          No solver has at least {filters.minAnswered} answered questions in this
          range. Lower the minimum or widen the dates.
        </p>
      </div>
    );
  }

  return (
    <div className="charts">
      <RankTable id="best-h" title="Best satisfaction" list={best} />
      <RankTable id="worst-h" title="Lowest satisfaction" list={worst} />
    </div>
  );
}

function RankTable({ id, title, list }: { id: string; title: string; list: RankedSolver[] }) {
  return (
    <div className="chart" aria-labelledby={id} style={{ paddingBottom: 14 }}>
      <h3 id={id}>{title}</h3>
      <div style={{ overflowX: "auto", margin: "0 -8px" }}>
        <table className="tbl tight" style={{ minWidth: 300 }}>
          <thead>
            <tr>
              <th style={{ width: 44 }}>Rank</th>
              <th>Name</th>
              <th className="num">Answered</th>
              <th className="num">Satisfaction</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => {
              const rated = s.satisfied + s.unsatisfied;
              return (
                <tr key={s.solverId}>
                  <td className="tnum">{i + 1}</td>
                  <td>
                    {s.name}
                    {!s.active && (
                      <>
                        {" "}
                        <span className="tag off">Deactivated</span>
                      </>
                    )}
                  </td>
                  <td className="num">{s.answered}</td>
                  <td className="num">
                    <b style={{ fontSize: 15 }}>{share(s.satisfied, rated)}</b>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {s.satisfied} of {rated} rated
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
