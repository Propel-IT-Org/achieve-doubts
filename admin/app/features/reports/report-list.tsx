import { useState } from "react";
import { Check, ExternalLink, Flag } from "lucide-react";
import { toast } from "sonner";
import { StatusPill } from "~/components/primitives";
import { ago } from "~/lib/format";
import { useResolveReport } from "~/lib/mutations";
import { type AdminReport, type ReportReason, useReports } from "~/lib/queries";
import { MAIN_SITE_URL, useTaxonomy } from "~/lib/taxonomy";

export const REASON_LABEL: Record<ReportReason, string> = {
  wrong: "Wrong solution",
  incomplete: "Incomplete or unclear answer",
  behaviour: "Rude or inappropriate reply",
  other: "Something else",
};

const REASONS = Object.keys(REASON_LABEL) as ReportReason[];

/** Open/resolved tabs, the reason filter, and the report cards. */
export function ReportList() {
  const reports = useReports();
  const [view, setView] = useState<"open" | "resolved">("open");
  const [reason, setReason] = useState<ReportReason | "">("");

  const openCount = reports.filter((r) => r.status === "open").length;
  const doneCount = reports.length - openCount;

  // Oldest open report first (it has waited longest); newest resolution first.
  const list = reports
    .filter((r) => r.status === view && (!reason || r.reason === reason))
    .sort((a, b) =>
      view === "open"
        ? Date.parse(a.createdAt) - Date.parse(b.createdAt)
        : Date.parse(b.resolvedAt ?? "") - Date.parse(a.resolvedAt ?? ""),
    );

  return (
    <>
      <div className="toolbar">
        <div className="seg" role="group" aria-label="Reports">
          <button type="button" aria-pressed={view === "open"} onClick={() => setView("open")}>
            Open ({openCount})
          </button>
          <button type="button" aria-pressed={view === "resolved"} onClick={() => setView("resolved")}>
            Resolved ({doneCount})
          </button>
        </div>
        <label className="field">
          <span className="sr">Reason</span>
          <select
            className="select"
            value={reason}
            aria-label="Reason"
            onChange={(e) => setReason(e.target.value as ReportReason | "")}
          >
            <option value="">All reasons</option>
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {REASON_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <p style={{ margin: 0 }}>
            {reason
              ? "No reports match this reason."
              : view === "open"
                ? "No open reports. Everything has been handled."
                : "No resolved reports yet."}
          </p>
        </div>
      ) : (
        <div className="reps" aria-live="polite">
          {list.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </div>
      )}
    </>
  );
}

function ReportCard({ report: r }: { report: AdminReport }) {
  const taxonomy = useTaxonomy();
  const resolve = useResolveReport();
  const q = r.question;
  const deleted = Boolean(q?.deletedAt);

  const onResolve = async () => {
    try {
      await resolve.trigger({ id: r.id });
      toast("Report resolved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't resolve the report");
    }
  };

  return (
    <article className={`rep${r.status === "resolved" ? " done" : ""}`} aria-labelledby={`rep-${r.id}`}>
      <div className="rep-h">
        <span className={`tag ${r.reason === "wrong" || r.reason === "behaviour" ? "warn" : "gold"}`}>
          <Flag size={12} />
          {REASON_LABEL[r.reason]}
        </span>
        {q && <StatusPill status={q.status} />}
        {deleted && <span className="tag warn">This question was deleted by an admin solver.</span>}
        <span className="when">{ago(r.createdAt)}</span>
      </div>

      <h2 className="rep-q" id={`rep-${r.id}`}>
        {q ? taxonomy.chapterName(q.chapterId) : `#${r.questionId}`}
        {q && (
          <small>
            #{q.id}, {taxonomy.subjectName(q.subjectId)}, {taxonomy.bookName(q.bookId)}
          </small>
        )}
      </h2>

      <p className="rep-msg">{r.text}</p>

      <div className="rep-meta">
        {r.reporter && (
          <span>
            Reported by <b>{r.reporter.name}</b>
          </span>
        )}
        {q?.solver && (
          <span>
            Solver: <b>{q.solver.name}</b>
          </span>
        )}
        {r.status === "resolved" && r.resolvedAt && (
          <span>
            Resolved by {r.resolver?.name ?? "a former admin"}, {ago(r.resolvedAt)}
          </span>
        )}
      </div>

      <div className="rep-actions">
        {q && !deleted && (
          <a
            className="btn btn-ghost btn-sm"
            href={`${MAIN_SITE_URL}/questions/${q.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={14} />
            Open on main site
          </a>
        )}
        {r.status === "open" && (
          <button
            type="button"
            className="btn btn-primary btn-sm push"
            disabled={resolve.isMutating}
            onClick={onResolve}
          >
            <Check size={14} />
            Resolve
          </button>
        )}
      </div>
    </article>
  );
}
