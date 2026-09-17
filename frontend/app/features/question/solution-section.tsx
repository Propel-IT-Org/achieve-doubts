import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ChevronRight, Clock, Lock, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncBoundary } from "~/components/async-boundary";
import { Attachments, Avatar } from "~/components/primitives";
import { PanelSkeleton } from "~/components/skeleton";
import { ago, shortName } from "~/lib/format";
import { useDeleteSolution, useSubmitSolution } from "~/lib/mutations";
import { type QuestionDetail, type SolutionRow, useQuestion } from "~/lib/queries";
import { isAdminSolver, useSession } from "~/lib/session";

export function SolutionSection({ id }: { id: number }) {
  const { user } = useSession();

  return (
    <section className="section" aria-labelledby="sol-h">
      <div className="section-h">
        <div>
          <h2 className="h3" id="sol-h">
            Solution
          </h2>
          <p>The solver's answer to this question.</p>
        </div>
      </div>

      {user ? (
        <AsyncBoundary fallback={<PanelSkeleton lines={4} />} errorText="Couldn't load the solution.">
          <SolutionBody id={id} />
        </AsyncBoundary>
      ) : (
        <SignInToSee />
      )}
    </section>
  );
}

function SignInToSee() {
  return (
    <div className="locked">
      <Lock size={22} aria-hidden="true" />
      <strong>Log in to see the solution</strong>
      <p className="muted" style={{ margin: 0, maxWidth: "32em" }}>
        Solutions and follow-ups are visible to registered students and solvers.
      </p>
      <div className="cta" style={{ justifyContent: "center", marginTop: 8 }}>
        <Link className="btn btn-primary btn-sm" to="/login">
          Student login
        </Link>
        <Link className="btn btn-ghost btn-sm" to="/login/solver">
          Solver login
        </Link>
      </div>
    </div>
  );
}

function SolutionBody({ id }: { id: number }) {
  const question = useQuestion(id);
  const { user } = useSession();
  const isAssignedSolver = user?.id === question.solverId;

  if (question.solution) {
    return (
      <SolutionCard
        id={id}
        question={question}
        solution={question.solution}
        isAssignedSolver={isAssignedSolver}
        canDelete={isAssignedSolver || isAdminSolver(user?.role)}
      />
    );
  }

  if (question.status === "waiting") {
    return (
      <div className="panel" style={{ display: "grid", gap: 10 }}>
        <p className="muted" style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
          <Clock size={16} aria-hidden="true" />
          No solution yet. The question is open for any solver to lock.
        </p>
      </div>
    );
  }

  if (isAssignedSolver) return <SolutionComposer id={id} />;

  return (
    <div className="panel">
      <p className="muted" style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}>
        <Clock size={16} aria-hidden="true" />
        {shortName(question.solver?.name ?? "A solver")} locked this question and
        is working on the solution.
      </p>
    </div>
  );
}

function SolutionCard({
  id,
  question,
  solution,
  isAssignedSolver,
  canDelete,
}: {
  id: number;
  question: QuestionDetail;
  solution: SolutionRow;
  isAssignedSolver: boolean;
  canDelete: boolean;
}) {
  const remove = useDeleteSolution(id);
  const [confirming, setConfirming] = useState(false);

  return (
    <article className="panel solution">
      <div className="sol-h">
        {question.solver && (
          <Link className="sol-who" to={`/solvers/${question.solver.id}`}>
            <Avatar name={question.solver.name} size={40} />
            <span className="sw-txt">
              <b>{isAssignedSolver ? "You" : question.solver.name}</b>
              <span className="muted">{ago(solution.createdAt)}</span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="sw-chev" />
          </Link>
        )}
        {canDelete && !confirming && (
          <button
            type="button"
            className="btn btn-text"
            style={{ color: "var(--coral-ink)", fontSize: 13 }}
            onClick={() => setConfirming(true)}
          >
            <Trash2 size={13} />
            Delete solution
          </button>
        )}
      </div>

      {confirming && (
        <div className="confirm" role="alertdialog" aria-label="Delete this solution?">
          <span style={{ flex: 1, minWidth: 220 }}>
            Delete this solution? The rating and follow-ups are cleared.
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={remove.isMutating}
            onClick={async () => {
              setConfirming(false);
              try {
                await remove.trigger();
                toast("Solution deleted.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Couldn't delete");
              }
            }}
          >
            Delete solution
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      )}

      {solution.text && <p className="sol-text">{solution.text}</p>}
      <Attachments
        imageUrl={solution.imageUrl}
        audioUrl={solution.audioUrl}
        audioSeconds={solution.audioSeconds}
        label="Image from the solver"
      />
      {isAssignedSolver && (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Solutions can't be edited. To change it, delete it and submit a new one.
        </p>
      )}
    </article>
  );
}

function SolutionComposer({ id }: { id: number }) {
  const submit = useSubmitSolution(id);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const send = async () => {
    if (!text.trim()) {
      setErr("Add the solution text before submitting.");
      return;
    }
    try {
      await submit.trigger({ text: text.trim() });
      setText("");
      toast("Solution submitted. The asker has been notified.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't submit");
    }
  };

  return (
    <div className="panel composer" style={{ marginTop: 0 }}>
      <label className="field">
        <span>Write the solution</span>
        <textarea
          className="textarea"
          style={{ minHeight: 160 }}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErr("");
          }}
        />
      </label>
      {err && (
        <div className="err" role="alert">
          <AlertTriangle size={16} />
          {err}
        </div>
      )}
      <div className="composer-row">
        <button
          type="button"
          className="btn btn-primary"
          style={{ marginLeft: "auto" }}
          disabled={submit.isMutating}
          onClick={send}
        >
          <Send size={15} />
          Submit solution
        </button>
      </div>
    </div>
  );
}
