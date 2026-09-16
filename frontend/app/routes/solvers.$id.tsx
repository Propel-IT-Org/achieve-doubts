import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { Award, ChevronLeft } from "lucide-react";
import useSWR, { preload } from "swr";

import type { Route } from "./+types/solvers.$id";
import {
  fetchSolverProfile,
  fetchSubjects,
  solverProfileKey,
  subjectsKey,
  swrConfig,
} from "~/lib/queries";
import { dur, fmt, formatDate, pct } from "~/lib/format";
import { Avatar } from "~/components/primitives";
import { buildTaxonomyLookup, QuestionCard } from "~/components/question-card";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Solver profile — Achieve Doubts" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  preload(subjectsKey(), fetchSubjects);
  preload(solverProfileKey(params.id), () => fetchSolverProfile(params.id));
  return null;
}

export default function SolverProfilePage() {
  const { id = "" } = useParams();
  const { data } = useSWR(
    solverProfileKey(id),
    () => fetchSolverProfile(id),
    swrConfig,
  );
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects, swrConfig);
  const taxonomy = useMemo(() => buildTaxonomyLookup(subjects ?? []), [subjects]);

  if (!data) return null;

  const creds = [data.institution, data.dept, data.batch ? `'${data.batch}` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <main id="main" className="page">
      <div className="wrap">
        <Link className="back" to="/questions">
          <ChevronLeft size={16} />
          Back
        </Link>

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

        <h2 className="h2">Recently solved</h2>
        {data.recentlySolved?.length ? (
          <div className="cards" style={{ marginTop: 16 }}>
            {data.recentlySolved.map((q) => (
              <QuestionCard key={q.id} question={q} taxonomy={taxonomy} compact />
            ))}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 16 }}>
            <p style={{ margin: 0 }}>No solved questions yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
