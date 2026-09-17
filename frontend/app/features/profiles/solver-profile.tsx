import { Award } from "lucide-react";
import { Avatar } from "~/components/primitives";
import { QuestionGrid } from "~/components/question-card";
import { dur, fmt, formatDate, pct } from "~/lib/format";
import { useSolverProfile } from "~/lib/queries";
import { useTaxonomy } from "~/lib/taxonomy";

export function SolverHeader({ id }: { id: string }) {
  const data = useSolverProfile(id);
  const creds = [data.institution, data.dept, data.batch ? `'${data.batch}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="prof">
      <Avatar name={data.name} size={84} />
      <div style={{ flex: 1, minWidth: 220 }}>
        <span className="auth-kind">
          <Award size={15} aria-hidden="true" />
          Solver
        </span>
        <h1>{data.name}</h1>
        <div className="prof-meta">
          {creds && <span>{creds}</span>}
          <span>Solver since {formatDate(data.joinedAt)}</span>
        </div>
      </div>
    </div>
  );
}

export function SolverMetrics({ id }: { id: string }) {
  const data = useSolverProfile(id);

  return (
    <div className="metrics" style={{ "--cols": 3 } as React.CSSProperties}>
      <div className="metric">
        <div className="v">{fmt(data.solved)}</div>
        <div className="l">Questions solved</div>
      </div>
      <div className="metric">
        <div className="v">{pct(data.satisfactionRate)}</div>
        <div className="l">Satisfaction rate</div>
      </div>
      <div className="metric">
        <div className="v">{dur(data.avgResponseMinutes)}</div>
        <div className="l">Average response time</div>
      </div>
    </div>
  );
}

export function SolverRecentlySolved({ id }: { id: string }) {
  const data = useSolverProfile(id);
  const taxonomy = useTaxonomy();
  return (
    <QuestionGrid
      questions={data.recentlySolved}
      taxonomy={taxonomy}
      empty="No solved questions yet."
    />
  );
}
