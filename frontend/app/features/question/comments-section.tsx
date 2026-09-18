import { useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncBoundary } from "~/components/async-boundary";
import { AttachRow, useMediaAttachments } from "~/components/media-attach";
import { Attachments, Avatar } from "~/components/primitives";
import { PanelSkeleton } from "~/components/skeleton";
import { ago, shortName } from "~/lib/format";
import { useDeleteComment, usePostComment } from "~/lib/mutations";
import { type CommentRow, useComments } from "~/lib/queries";
import { isAdminSolver, isSolver, useSession } from "~/lib/session";

/** Public discussion. New comments arrive live via COMMENTS_CHANGED. */
export function CommentsSection({ id }: { id: number }) {
  return (
    <section className="section" aria-labelledby="comments-h">
      <div className="section-h">
        <div>
          <h2 className="h3" id="comments-h">
            Comments
          </h2>
          <p>Students and solvers can discuss this question here.</p>
        </div>
      </div>

      <div className="panel">
        <AsyncBoundary fallback={<PanelSkeleton />} errorText="Couldn't load the comments.">
          <CommentList id={id} />
        </AsyncBoundary>
      </div>
    </section>
  );
}

function CommentList({ id }: { id: number }) {
  const comments = useComments(id);

  return (
    <>
      {comments.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No comments yet. Start the discussion.
        </p>
      ) : (
        <div>
          {comments.map((c) => (
            <Comment key={c.id} questionId={id} comment={c} />
          ))}
        </div>
      )}

      <div
        className="composer"
        style={{
          borderTop: comments.length ? "1px solid var(--line2)" : 0,
          paddingTop: comments.length ? 16 : 0,
        }}
      >
        <CommentComposer id={id} />
      </div>
    </>
  );
}

function Comment({ questionId, comment: c }: { questionId: number; comment: CommentRow }) {
  const { user } = useSession();
  const remove = useDeleteComment(questionId);
  const name = c.authorName ?? "Former member";
  const solverAuthor = isSolver(c.authorRole);
  // Solvers' comments link to their solver profile, students' to theirs.
  const profile = solverAuthor ? `/solvers/${c.authorId}` : `/students/${c.authorId}`;

  const onDelete = async () => {
    try {
      await remove.trigger({ commentId: c.id });
      toast("Comment removed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the comment");
    }
  };

  return (
    <div className="comment">
      <Avatar name={name} size={36} />
      <div>
        <div className="ch">
          <span className="ch-who">
            <Link className="linkish" to={profile} aria-label={`View ${name}'s profile`}>
              {user?.id === c.authorId ? "You" : shortName(name)}
            </Link>
            {solverAuthor && <span className="tag">Solver</span>}
            <span className="ch-time">{ago(c.createdAt)}</span>
          </span>
          {isAdminSolver(user?.role) && !c.deleted && (
            <button
              type="button"
              className="btn btn-text"
              style={{ color: "var(--coral-ink)", fontSize: 13 }}
              disabled={remove.isMutating}
              onClick={onDelete}
            >
              <Trash2 size={13} />
              Delete
            </button>
          )}
        </div>
        {c.deleted ? (
          <p className="muted" style={{ fontStyle: "italic" }}>
            Removed by an admin
          </p>
        ) : (
          <>
            {c.text && <p>{c.text}</p>}
            {(c.imageUrl || c.audioUrl) && (
              <div className="cm-att">
                <Attachments
                  imageUrl={c.imageUrl}
                  audioUrl={c.audioUrl}
                  audioSeconds={c.audioSeconds}
                  label={`Image from ${shortName(name)}`}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CommentComposer({ id }: { id: number }) {
  const { user } = useSession();
  const post = usePostComment(id);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const media = useMediaAttachments(setErr);

  if (!user) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        <Link className="btn btn-text" to="/login">
          Log in to comment.
        </Link>
      </p>
    );
  }

  const send = async () => {
    if (!text.trim() && !media.hasMedia) {
      setErr("Add text, an image or an audio note before posting.");
      return;
    }
    try {
      await post.trigger({ text: text.trim() || undefined, ...media.payload() });
      setText("");
      media.reset();
      toast("Comment posted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't post");
    }
  };

  return (
    <>
      <label className="field">
        <span>Add a comment</span>
        <textarea
          className="textarea"
          style={{ minHeight: 80 }}
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
          <MessageSquare size={15} />
          Post comment
        </button>
      </div>
    </>
  );
}
