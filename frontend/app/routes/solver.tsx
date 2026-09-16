import { useMemo } from "react";
import { Link } from "react-router";
import { AlertTriangle, Lock, Search } from "lucide-react";
import useSWR, { preload } from "swr";

import type { Route } from "./+types/solver";
import {
  dashboardKey,
  fetchDashboard,
  fetchSubjects,
  subjectsKey,
  swrConfig,
} from "~/lib/queries";
import { ago, dur, fmt, pct, shortName } from "~/lib/format";
import { isSolver, useSession } from "~/lib/session";
import { Avatar, Gate } from "~/components/primitives";
import { buildTaxonomyLookup, QuestionCard } from "~/components/question-card";

const FOLLOWUP_BLOCK = 3;

export function meta(_: Route.MetaArgs) {
  return [{ title: "Solver dashboard — Achieve Doubts" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(subjectsKey(), fetchSubjects);
  preload(dashboardKey(), fetchDashboard);
  return null;
}

export default function SolverDashboard() {
  const { user, isPending } = useSession();

  if (isPending) return null;

  if (!isSolver(user?.role)) {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<Lock size={24} />}
            title="Solver dashboard"
            text="This page is for solvers. Log in with a solver account to see it."
          >
            <Link className="btn btn-primary" to="/login/solver">
              Solver login
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  return <DashboardBody name={user?.name ?? "Solver"} isAdmin={user?.role === "adminSolver"} />;
}

function DashboardBody({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const { data } = useSWR(dashboardKey(), fetchDashboard, swrConfig);
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects, swrConfig);
  const taxonomy = useMemo(() => buildTaxonomyLookup(subjects ?? []), [subjects]);

  if (!data) return null;

  const pending = data.pendingFollowups ?? [];
  const blocked = pending.length >= FOLLOWUP_BLOCK;

  return (
    <main id="main" className="page">
      <div className="wrap">
        <div className="prof" style={{ marginBottom: 24 }}>
          <Avatar name={name} size={64} />
          <div>
            <h1 style={{ fontSize: "clamp(30px,4vw,42px)" }}>Solver dashboard</h1>
            <div className="prof-meta">
              <span>{name}</span>
              {isAdmin && <span className="tag gold">Admin solver</span>}
            </div>
          </div>
        </div>

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

        {blocked ? (
          <div className="callout warn" role="status" style={{ marginBottom: 28 }}>
            <AlertTriangle size={20} />
            <div>
              <h3>Answer your follow-ups first</h3>
              <p>
                You have {pending.length} unanswered follow-ups. You can't lock new
                questions until fewer than {FOLLOWUP_BLOCK} are open. Reply in each
                thread to clear them.
              </p>
            </div>
          </div>
        ) : (
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
        )}

        <div className="two">
          <section className="panel" aria-labelledby="mine-h">
            <h2 className="h3" id="mine-h" style={{ fontSize: 22 }}>
              Locked by you, waiting for your answer{" "}
              <span className="tag gold">{data.lockedByMe?.length ?? 0}</span>
            </h2>
            {data.lockedByMe?.length ? (
              <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
                {data.lockedByMe.map((q) => (
                  <QuestionCard key={q.id} question={q} taxonomy={taxonomy} compact />
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                You haven't locked any questions.
              </p>
            )}
          </section>

          <section className="panel" aria-labelledby="pend-h">
            <h2 className="h3" id="pend-h" style={{ fontSize: 22 }}>
              Unanswered follow-ups{" "}
              <span className={`tag ${blocked ? "off" : ""}`}>{pending.length}</span>
            </h2>
            <div className="rule-line">
              <span className={`rule-dots${blocked ? " full" : ""}`} aria-hidden="true">
                {Array.from({ length: FOLLOWUP_BLOCK }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length indicator
                  <i key={i} className={i < pending.length ? "on" : ""} />
                ))}
              </span>
              <span>
                Open follow-ups: {Math.min(pending.length, FOLLOWUP_BLOCK)} of{" "}
                {FOLLOWUP_BLOCK}. At {FOLLOWUP_BLOCK}, locking new questions pauses.
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
          </section>
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
            <p style={{ margin: 0 }}>You haven't answered any questions yet.</p>
          </div>
        )}
      </div>
    </main>
  );
}
