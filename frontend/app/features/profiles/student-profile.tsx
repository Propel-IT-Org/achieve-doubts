import { Link } from "react-router";
import { Plus, User } from "lucide-react";
import { Avatar } from "~/components/primitives";
import { QuestionGrid } from "~/components/question-card";
import { clock, fmt, formatDate, pct } from "~/lib/format";
import { useStudentProfile } from "~/lib/queries";
import { useSession } from "~/lib/session";
import { useTaxonomy } from "~/lib/taxonomy";

export function StudentHeader({ id }: { id: string }) {
  const data = useStudentProfile(id);
  const { user } = useSession();

  return (
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
      {user?.id === data.id && (
        <Link className="btn btn-primary" to="/ask">
          <Plus size={16} />
          Ask a question
        </Link>
      )}
    </div>
  );
}

export function StudentMetrics({ id }: { id: string }) {
  const data = useStudentProfile(id);

  return (
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
  );
}

export function StudentRecentQuestions({ id }: { id: string }) {
  const data = useStudentProfile(id);
  const taxonomy = useTaxonomy();
  return (
    <QuestionGrid questions={data.recentQuestions} taxonomy={taxonomy} empty="No questions yet." />
  );
}
