import { useState } from "react";
import { AlertTriangle, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { AsyncBoundary } from "~/components/async-boundary";
import { AttachRow, useMediaAttachments } from "~/components/media-attach";
import { Attachments } from "~/components/primitives";
import { PanelSkeleton } from "~/components/skeleton";
import { ago, shortName } from "~/lib/format";
import { usePostThreadMessage } from "~/lib/mutations";
import { type ThreadRow, useQuestion, useThread } from "~/lib/queries";
import { useSession } from "~/lib/session";

/**
 * The private follow-up thread. Messages arrive live: the feed's
 * THREAD_CHANGED event revalidates this key, so the asker and the solver
 * see each other's replies without reloading.
 */
export function ThreadSection({ id }: { id: number }) {
  const { user } = useSession();

  return (
    <section className="section" aria-labelledby="thread-h">
      <div className="section-h">
        <div>
          <h2 className="h3" id="thread-h">
            Follow-up thread
          </h2>
          <p>
            Follow-up conversation about the solution. Only{" "}
            <AsyncBoundary fallback="the asker">
              <AskerName id={id} />
            </AsyncBoundary>{" "}
            and the solver can post here; other students can read along.
          </p>
        </div>
      </div>

      {user ? (
        <AsyncBoundary fallback={<PanelSkeleton />} errorText="Couldn't load the follow-up thread.">
          <ThreadBody id={id} userId={user.id} />
        </AsyncBoundary>
      ) : (
        <div className="locked">
          <Lock size={22} aria-hidden="true" />
          <strong>Log in to read the follow-up thread</strong>
        </div>
      )}
    </section>
  );
}

function AskerName({ id }: { id: number }) {
  return <>{shortName(useQuestion(id).asker?.name ?? "the asker")}</>;
}

function ThreadBody({ id, userId }: { id: number; userId: string }) {
  const question = useQuestion(id);
  const hasSolution = Boolean(question.solution);
  const messages = useThread(id, hasSolution);
  const canPost = userId === question.askerId || userId === question.solverId;

  if (!hasSolution) {
    return (
      <div className="panel">
        <p className="muted" style={{ margin: 0 }}>
          The follow-up thread opens once the solver submits a solution.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="thread">
        {messages.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            No follow-up messages yet.
          </p>
        )}
        {messages.map((m) => (
          <ThreadMessage
            key={m.id}
            message={m}
            author={
              m.authorSide === "solver"
                ? (question.solver?.name ?? "Solver")
                : (question.asker?.name ?? "Asker")
            }
          />
        ))}
      </div>

      {canPost ? (
        <ThreadComposer id={id} asAsker={userId === question.askerId} />
      ) : (
        <p className="muted" style={{ margin: "16px 0 0", fontSize: 14 }}>
          You can read this thread. To join the discussion, use the comments below.
        </p>
      )}
    </div>
  );
}

function ThreadMessage({ message: m, author }: { message: ThreadRow; author: string }) {
  return (
    <div className={`msg ${m.authorSide}`}>
      <div className="msg-h">
        <b>{shortName(author)}</b>
        <span>{m.authorSide === "solver" ? "Solver" : "Asker"}</span>
        <span>{ago(m.createdAt)}</span>
      </div>
      {m.deleted ? (
        <div className="bubble removed">Removed by an admin</div>
      ) : (
        <>
          {m.text && <div className="bubble">{m.text}</div>}
          <Attachments
            imageUrl={m.imageUrl}
            audioUrl={m.audioUrl}
            audioSeconds={m.audioSeconds}
            label="Attachment"
          />
        </>
      )}
    </div>
  );
}

/** The asker asks follow-ups; the solver replies (prototype wording). */
function ThreadComposer({ id, asAsker }: { id: number; asAsker: boolean }) {
  const post = usePostThreadMessage(id);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const media = useMediaAttachments(setErr);

  const send = async () => {
    if (!text.trim() && !media.hasMedia) {
      setErr("Add text, an image or an audio note before sending.");
      return;
    }
    try {
      await post.trigger({ text: text.trim() || undefined, ...media.payload() });
      setText("");
      media.reset();
      toast(asAsker ? "Follow-up sent" : "Reply sent");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send");
    }
  };

  return (
    <div className="composer">
      <label className="field">
        <span>{asAsker ? "Ask a follow-up question" : "Write a reply"}</span>
        <textarea
          className="textarea"
          style={{ minHeight: 90 }}
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
        <AttachRow media={media} />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ marginLeft: "auto" }}
          disabled={post.isMutating || media.busy}
          onClick={send}
        >
          <Send size={15} />
          {asAsker ? "Send follow-up" : "Send reply"}
        </button>
      </div>
    </div>
  );
}
