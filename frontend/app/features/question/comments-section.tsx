import { useState } from "react";
import { Link } from "react-router";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { AsyncBoundary } from "~/components/async-boundary";
import { Attachments, Avatar } from "~/components/primitives";
import { PanelSkeleton } from "~/components/skeleton";
import { ago } from "~/lib/format";
import { usePostComment } from "~/lib/mutations";
import { type CommentRow, useComments } from "~/lib/queries";
import { useSession } from "~/lib/session";

/** Public discussion. New comments arrive live via COMMENTS_CHANGED. */
export function CommentsSection({ id }: { id: number }) {
  return (
    <section className="section" aria-labelledby="comments-h">
      <div className="section-h">
        <div>
          <h2 className="h3" id="comments-h">
            Comments
          </h2>
          <p>Any registered student can discuss this question here.</p>
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
            <Comment key={c.id} comment={c} />
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

function Comment({ comment: c }: { comment: CommentRow }) {
  return (
    <div className="comment">
      <Avatar name={c.authorId} size={36} />
      <div>
        <div className="ch">
          <span className="ch-who">
            <Link className="linkish" to={`/students/${c.authorId}`}>
              Student
            </Link>
            <span className="ch-time">{ago(c.createdAt)}</span>
          </span>
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
                  label="Attachment"
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

  if (!user) {
    return (
      <p className="muted" style={{ margin: 0 }}>
        <Link className="btn btn-text" to="/login">
          Log in as a student to comment.
        </Link>
      </p>
    );
  }

  if (user.role !== "student") {
    return (
      <p className="muted" style={{ margin: 0 }}>
        Comments are for students. Reply to the asker in the thread above.
      </p>
    );
  }

  const send = async () => {
    if (!text.trim()) return;
    try {
      await post.trigger({ text: text.trim() });
      setText("");
      toast("Comment posted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't post");
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
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <div className="composer-row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ marginLeft: "auto" }}
          disabled={post.isMutating}
          onClick={send}
        >
          <MessageSquare size={15} />
          Post comment
        </button>
      </div>
    </>
  );
}
