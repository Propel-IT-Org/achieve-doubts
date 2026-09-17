import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { ChevronLeft, Plus, User } from "lucide-react";
import useSWR, { preload } from "swr";

import type { Route } from "./+types/students.$id";
import {
  fetchStudentProfile,
  fetchSubjects,
  studentProfileKey,
  subjectsKey,
} from "~/lib/queries";
import { clock, fmt, formatDate, pct } from "~/lib/format";
import { useSession } from "~/lib/session";
import { Avatar } from "~/components/primitives";
import { buildTaxonomyLookup, QuestionCard } from "~/components/question-card";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Student profile — Achieve Doubts" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  preload(subjectsKey(), fetchSubjects);
  preload(studentProfileKey(params.id), () => fetchStudentProfile(params.id));
  return null;
}

export default function StudentProfilePage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const { data } = useSWR(studentProfileKey(id), () => fetchStudentProfile(id));
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects);
  const taxonomy = useMemo(
    () => buildTaxonomyLookup(subjects ?? []),
    [subjects],
  );

  if (!data) return null;

  const own = user?.id === data.id;

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
              <User size={15} aria-hidden="true" />
              Student
            </span>
            <h1>{data.name}</h1>
            <div className="prof-meta">
              {data.hscYear && <span>HSC {data.hscYear}</span>}
              {data.college && <span>{data.college}</span>}
              {data.district && <span>{data.district}</span>}
              <span>Joined {formatDate(data.joinedAt)}</span>
            </div>
          </div>
          {own && (
            <Link className="btn btn-primary" to="/ask">
              <Plus size={16} />
              Ask a question
            </Link>
          )}
        </div>

        <div className="metrics" style={{ "--cols": 4 } as React.CSSProperties}>
          <div className="metric">
            <div className="v">{fmt(data.asked)}</div>
            <div className="l">Questions asked</div>
          </div>
          <div className="metric">
            <div className="v">{pct(data.satisfactionRate)}</div>
            <div className="l">Satisfaction rate</div>
          </div>
          <div className="metric">
            <div className="v">{fmt(data.answered)}</div>
            <div className="l">Answered</div>
          </div>
          <div className="metric">
            <div className="v">{clock(data.avgMatchSeconds)}</div>
            <div className="l">Average wait for a solver</div>
          </div>
        </div>

        <h2 className="h2">Recent questions</h2>
        {data.recentQuestions?.length ? (
          <div className="cards" style={{ marginTop: 16 }}>
            {data.recentQuestions.map((q) => (
              <QuestionCard
                key={q.id}
                question={q}
                taxonomy={taxonomy}
                compact
              />
            ))}
          </div>
        ) : (
          <div className="empty" style={{ marginTop: 16 }}>
            <p style={{ margin: 0 }}>No questions yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
