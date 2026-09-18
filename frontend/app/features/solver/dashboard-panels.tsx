import { Link } from "react-router";
import { AsyncBoundary } from "~/components/async-boundary";
import { QuestionCard, QuestionGrid } from "~/components/question-card";
import { PanelSkeleton } from "~/components/skeleton";
import { ago } from "~/lib/format";
import { useDashboard } from "~/lib/queries";
import { useTaxonomy } from "~/lib/taxonomy";

/** A count tag that fills in once the dashboard loads. */
function Count({ of }: { of: "locked" | "pending" }) {
  const data = useDashboard();
  if (of === "locked") return <span className="tag gold">{data.lockedByMe.length}</span>;
  return (
    <span className={`tag ${data.lockBlocked ? "off" : ""}`}>{data.pendingFollowups.length}</span>
  );
}

export function LockedByMePanel() {
  return (
    <section className="panel" aria-labelledby="mine-h">
      <h2 className="h3" id="mine-h" style={{ fontSize: 22 }}>
        Locked by you, waiting for your answer{" "}
        <AsyncBoundary fallback={null}>
          <Count of="locked" />
        </AsyncBoundary>
      </h2>
      <AsyncBoundary fallback={<PanelSkeleton />} errorText="Couldn't load your locked questions.">
        <LockedByMe />
      </AsyncBoundary>
    </section>
  );
}

function LockedByMe() {
  const { lockedByMe } = useDashboard();
  const taxonomy = useTaxonomy();

  if (!lockedByMe.length) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        You haven't locked any questions.
      </p>
    );
  }
  return (
    <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
      {lockedByMe.map((q) => (
        <QuestionCard key={q.id} question={q} taxonomy={taxonomy} compact />
      ))}
    </div>
  );
}

export function FollowupsPanel() {
  return (
    <section className="panel" aria-labelledby="pend-h">
      <h2 className="h3" id="pend-h" style={{ fontSize: 22 }}>
        Unanswered follow-ups{" "}
        <AsyncBoundary fallback={null}>
          <Count of="pending" />
        </AsyncBoundary>
      </h2>
      <AsyncBoundary fallback={<PanelSkeleton />} errorText="Couldn't load your follow-ups.">
        <Followups />
      </AsyncBoundary>
    </section>
  );
}

function Followups() {
  const { pendingFollowups: pending, followupLimit: limit, lockBlocked } = useDashboard();
  const taxonomy = useTaxonomy();

  return (
    <>
      <div className="rule-line">
        <span className={`rule-dots${lockBlocked ? " full" : ""}`} aria-hidden="true">
          {Array.from({ length: limit }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length indicator
            <i key={i} className={i < pending.length ? "on" : ""} />
          ))}
        </span>
        <span>
          Open follow-ups: {pending.length}. With more than {limit}, locking
          new questions pauses.
        </span>
      </div>
      {pending.length ? (
        <ul className="rowlist">
          {pending.map((q) => (
            <li key={q.id}>
              <div className="rl-main">
                <b>
                  {taxonomy.chapterName(q.chapterId)}{" "}
                  <span className="muted" style={{ fontWeight: 400 }}>
                    #{q.id}
                  </span>
                </b>
                <span>{ago(q.askedAt)}</span>
              </div>
              <Link className="btn btn-primary btn-sm" to={`/questions/${q.id}`}>
                Answer follow-up
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No follow-ups are waiting for you.
        </p>
      )}
    </>
  );
}

export function RecentlySolved() {
  const { recentlySolved } = useDashboard();
  const taxonomy = useTaxonomy();
  return (
    <QuestionGrid
      questions={recentlySolved}
      taxonomy={taxonomy}
      empty="You haven't answered any questions yet."
    />
  );
}
