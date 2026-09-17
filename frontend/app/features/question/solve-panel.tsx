import { useState } from "react";
import { Lock, ShieldCheck, Unlock } from "lucide-react";
import { AsyncBoundary } from "~/components/async-boundary";
import { Skeleton } from "~/components/skeleton";
import { shortName } from "~/lib/format";
import { useLockQuestion, useOverrideLock, useUnlockQuestion } from "~/lib/mutations";
import { useQuestion } from "~/lib/queries";
import { isAdminSolver, useSession } from "~/lib/session";
import { useAction } from "./use-action";

/**
 * The solver's lock bar. It re-renders as soon as the feed reports another
 * solver taking the question, so "Lock to solve" never lingers on a question
 * that's already gone.
 */
export function SolvePanel({ id }: { id: number }) {
  return (
    <section className="panel solve-box" aria-labelledby="solve-h">
      <h2 className="h3" id="solve-h" style={{ fontSize: 20, margin: 0 }}>
        Solve this question
      </h2>
      <AsyncBoundary
        fallback={<Skeleton height={44} radius={12} />}
        errorText="Couldn't load the lock state."
      >
        <LockBar id={id} />
      </AsyncBoundary>
    </section>
  );
}

function LockBar({ id }: { id: number }) {
  const question = useQuestion(id);
  const { user } = useSession();
  const run = useAction();
  const lock = useLockQuestion();
  const unlock = useUnlockQuestion();
  const override = useOverrideLock();
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const mine = user?.id === question.solverId;
  const solverName = shortName(question.solver?.name ?? "another solver");

  let body: React.ReactNode;

  if (question.status === "waiting") {
    body = (
      <>
        <span className="lb-note">Open to every solver. The first to lock it answers.</span>
        <span className="lb-actions">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={lock.isMutating}
            onClick={() =>
              run(
                () => lock.trigger({ id }),
                `Question #${id} is locked. Only you can answer it now.`,
              )
            }
          >
            <Lock size={14} />
            Lock to solve
          </button>
        </span>
      </>
    );
  } else if (mine && !question.solution && confirmUnlock) {
    body = (
      <div className="confirm" role="alertdialog" aria-label="Unlock this question?">
        <span style={{ flex: 1, minWidth: 180 }}>
          Unlock this question? Any solver will be able to lock it.
        </span>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          onClick={() => {
            setConfirmUnlock(false);
            void run(
              () => unlock.trigger({ id }),
              `Question #${id} is unlocked and open to every solver again.`,
            );
          }}
        >
          <Unlock size={14} />
          Unlock
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setConfirmUnlock(false)}
        >
          Cancel
        </button>
      </div>
    );
  } else if (mine && !question.solution) {
    body = (
      <>
        <span className="lb-note">
          <span className="tag gold">
            <Lock size={12} />
            Locked by you
          </span>
          <span>You can unlock until you submit the solution.</span>
        </span>
        <span className="lb-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirmUnlock(true)}
          >
            <Unlock size={14} />
            Unlock
          </button>
        </span>
      </>
    );
  } else if (question.status === "assigned" && !mine && isAdminSolver(user?.role)) {
    body = (
      <>
        <span className="lb-note">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Lock size={14} />
            Locked by {solverName}
          </span>
          <span>As an admin solver you can take this lock over.</span>
        </span>
        <span className="lb-actions">
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={override.isMutating}
            onClick={() =>
              run(() => override.trigger({ id }), `You took over question #${id}.`)
            }
          >
            <ShieldCheck size={14} />
            Override lock
          </button>
        </span>
      </>
    );
  } else {
    body = (
      <span className="lb-note">
        <Lock size={14} />
        {mine ? "You answered this question" : `Locked by ${solverName}`}
      </span>
    );
  }

  return <div className={`lockbar${mine ? " mine" : ""}`}>{body}</div>;
}
