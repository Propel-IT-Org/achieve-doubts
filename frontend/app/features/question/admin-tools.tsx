import { useState } from "react";
import { useNavigate } from "react-router";
import { Shield, Trash2 } from "lucide-react";
import { useDeleteQuestion } from "~/lib/mutations";
import { useAction } from "./use-action";

/** Admin solvers' moderation box. Needs no question data, so never waits. */
export function AdminTools({ id }: { id: number }) {
  const run = useAction();
  const navigate = useNavigate();
  const removeQuestion = useDeleteQuestion();
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="panel solve-box tools" aria-labelledby="tools-h">
      <h2
        className="h3"
        id="tools-h"
        style={{ fontSize: 20, margin: 0, display: "flex", alignItems: "center", gap: 8 }}
      >
        <Shield size={18} aria-hidden="true" />
        Admin solver tools
      </h2>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        You can delete this question, delete any solution, follow-up or comment,
        and take over locks held by other solvers.
      </p>
      {confirming ? (
        <div className="confirm" role="alertdialog" aria-label="Delete this question?">
          <span style={{ flexBasis: "100%" }}>
            Delete this question for everyone? This can't be undone.
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={removeQuestion.isMutating}
            onClick={async () => {
              const ok = await run(
                () => removeQuestion.trigger({ id }),
                `Question #${id} was deleted.`,
              );
              if (ok) navigate("/questions");
            }}
          >
            <Trash2 size={14} />
            Delete question
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-danger btn-sm"
          style={{ justifySelf: "start" }}
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={14} />
          Delete question
        </button>
      )}
    </section>
  );
}
