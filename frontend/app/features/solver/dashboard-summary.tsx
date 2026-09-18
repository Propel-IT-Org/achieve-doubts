import { Link } from "react-router";
import { AlertTriangle, Search } from "lucide-react";
import { dur, fmt, pct } from "~/lib/format";
import { useDashboard } from "~/lib/queries";

export function DashboardMetrics() {
  const data = useDashboard();

  return (
    <div className="metrics" style={{ "--cols": 5 } as React.CSSProperties}>
      <div className="metric">
        <div className="v">{fmt(data.solved)}</div>
        <div className="l">Questions solved</div>
      </div>
      <div className="metric">
        <div className="v">{pct(data.satisfactionRate)}</div>
        <div className="l">Satisfaction rate</div>
      </div>
      <div className="metric">
        <div className="v">{fmt(data.locked)}</div>
        <div className="l">Questions locked</div>
      </div>
      <div className="metric">
        <div className="v">{pct(data.unlockRate)}</div>
        <div className="l">Unlock rate</div>
        <div className="s">Locks you released without answering</div>
      </div>
      <div className="metric">
        <div className="v">{dur(data.avgResponseMinutes)}</div>
        <div className="l">Average response time</div>
      </div>
    </div>
  );
}

/** Either the way to open questions, or why locking is paused. */
export function FindOrBlocked() {
  const data = useDashboard();
  const pending = data.pendingFollowups.length;

  if (data.lockBlocked) {
    return (
      <div className="callout warn" role="status" style={{ marginBottom: 28 }}>
        <AlertTriangle size={20} />
        <div>
          <h3>Answer your follow-ups first</h3>
          <p>
            You have {pending} unanswered follow-ups. You can't lock new
            questions while more than {data.followupLimit} are open. Reply in
            each thread to clear them.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section className="find" aria-labelledby="find-h">
      <div>
        <h2 id="find-h">Find a question to solve</h2>
        <p>
          {data.openQuestions} questions are open right now. Every solver sees
          the same list; the first to lock a question answers it.
        </p>
      </div>
      <Link className="btn btn-gold" to="/questions?status=waiting">
        <Search size={16} />
        Browse open questions
      </Link>
    </section>
  );
}
