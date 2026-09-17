import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  ImageIcon,
  Lock,
  MessageSquare,
  Send,
  Shield,
  ShieldCheck,
  Trash2,
  Unlock,
} from "lucide-react";
import useSWR, { preload } from "swr";

import type { Route } from "./+types/questions.$id";
import {
  commentsKey,
  fetchComments,
  fetchQuestion,
  fetchSubjects,
  fetchThread,
  questionKey,
  subjectsKey,
  threadKey,
} from "~/lib/queries";
import {
  useCreateReport,
  useDeleteQuestion,
  useDeleteSolution,
  useLockQuestion,
  useOverrideLock,
  usePostComment,
  usePostThreadMessage,
  useRateQuestion,
  useSubmitSolution,
  useUnlockQuestion,
} from "~/lib/mutations";
import { ago, clock, dur, shortName } from "~/lib/format";
import { isAdminSolver, isSolver, useSession } from "~/lib/session";
import {
  Attachments,
  Avatar,
  Gate,
  StatusPill,
  Trace,
} from "~/components/primitives";
import { buildTaxonomyLookup } from "~/components/question-card";
import { useToast } from "~/components/toast";

const REPORT_REASONS = [
  ["wrong", "Wrong solution"],
  ["incomplete", "Incomplete or unclear answer"],
  ["behaviour", "Rude or inappropriate reply"],
  ["other", "Something else"],
] as const;

const ANSWERED = ["answered", "satisfied", "unsatisfied"];

export function meta(_: Route.MetaArgs) {
  return [{ title: "Question — Achieve Doubts" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  const id = Number(params.id);
  preload(subjectsKey(), fetchSubjects);
  preload(questionKey(id), () => fetchQuestion(id));
  preload(commentsKey(id), () => fetchComments(id));
  return null;
}

export default function QuestionDetail() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useSession();
  const flash = useToast();
  const navigate = useNavigate();

  const { data: question } = useSWR(questionKey(id), () => fetchQuestion(id));
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects);
  const taxonomy = useMemo(
    () => buildTaxonomyLookup(subjects ?? []),
    [subjects],
  );

  const lock = useLockQuestion();
  const unlock = useUnlockQuestion();
  const override = useOverrideLock();
  const removeQuestion = useDeleteQuestion();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  if (!question) return null;

  const isAsker = user?.id === question.askerId;
  const mine = user?.id === question.solverId;
  const loggedIn = Boolean(user);
  const solution = question.solution ?? null;
  const chapterNo = taxonomy.chapterNumber(question.chapterId);

  const assignedAt = question.matchedAfterSec
    ? new Date(question.askedAt).getTime() + question.matchedAfterSec * 1000
    : null;

  const subs = [
    ago(question.askedAt),
    question.matchedAfterSec != null
      ? `after ${clock(question.matchedAfterSec)}`
      : "Waiting",
    solution && assignedAt
      ? `after ${dur((new Date(solution.createdAt).getTime() - assignedAt) / 60000)}`
      : "Not yet",
    question.status === "satisfied"
      ? "Satisfied"
      : question.status === "unsatisfied"
        ? "Not satisfied"
        : question.status === "answered"
          ? "Awaiting rating"
          : "Not yet",
  ];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      flash(ok);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <main id="main" className="page">
      <div className={`wrap${isSolver(user?.role) ? "" : " narrow"}`}>
        <Link to="/questions" className="back">
          <ChevronLeft size={16} />
          Back to questions
        </Link>

        <div className={`detail${isSolver(user?.role) ? "" : " no-side"}`}>
          <div className="d-main">
            <article className="qhead d-qhead" aria-labelledby="q-title">
              <div className="qc-bar">
                <span className="qc-subj">
                  {taxonomy.subjectName(question.subjectId)}{" "}
                  <span className="qc-book">
                    / {taxonomy.bookName(question.bookId)}
                  </span>
                </span>
                <StatusPill status={question.status} />
              </div>

              <div className="qc-title">
                <span className="qc-num" aria-hidden="true">
                  {chapterNo}
                </span>
                <div>
                  <span className="qc-chlbl">
                    Chapter<span className="sr"> {chapterNo}</span>
                  </span>
                  <h1
                    className="qc-chap"
                    id="q-title"
                    style={{ margin: 0, fontWeight: 400 }}
                  >
                    {taxonomy.chapterName(question.chapterId)}
                  </h1>
                </div>
              </div>

              <p className="qtext">{question.text}</p>

              {question.photoUrl ? (
                <figure className="qphoto" style={{ margin: 0 }}>
                  <img src={question.photoUrl} alt="Question attachment" />
                  <figcaption>1 photo</figcaption>
                </figure>
              ) : (
                <span className="nophoto">
                  <ImageIcon size={16} aria-hidden="true" />
                  No photo attached
                </span>
              )}

              <Trace status={question.status} big subs={subs} />

              <div className="qc-foot q-by">
                {question.asker && (
                  <span>
                    Asked by{" "}
                    <Link
                      className="linkish"
                      to={`/students/${question.asker.id}`}
                    >
                      {shortName(question.asker.name)}
                    </Link>
                  </span>
                )}
                <span>{ago(question.askedAt)}</span>
              </div>
            </article>

            <div className="d-body">
              <SolutionSection
                questionId={id}
                question={question}
                loggedIn={loggedIn}
                isAssignedSolver={mine}
                canModerate={isAdminSolver(user?.role)}
              />

              {isAsker && ANSWERED.includes(question.status) && (
                <RatingSection questionId={id} status={question.status} />
              )}

              {isAsker && solution && <ReportBox questionId={id} />}

              <ThreadSection
                questionId={id}
                loggedIn={loggedIn}
                hasSolution={Boolean(solution)}
                canPost={isAsker || mine}
                canModerate={isAdminSolver(user?.role)}
                askerName={question.asker?.name ?? "Asker"}
                solverName={question.solver?.name ?? "Solver"}
              />

              <CommentsSection
                questionId={id}
                canComment={user?.role === "student"}
                loggedIn={loggedIn}
                canModerate={isAdminSolver(user?.role)}
              />
            </div>
          </div>

          <div className="aside">
            <div className="d-actions">
              {isSolver(user?.role) && (
                <section className="panel solve-box" aria-labelledby="solve-h">
                  <h2
                    className="h3"
                    id="solve-h"
                    style={{ fontSize: 20, margin: 0 }}
                  >
                    Solve this question
                  </h2>

                  <div className={`lockbar${mine ? " mine" : ""}`}>
                    {question.status === "waiting" ? (
                      <>
                        <span className="lb-note">
                          Open to every solver. The first to lock it answers.
                        </span>
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
                    ) : mine && !solution ? (
                      confirmUnlock ? (
                        <div
                          className="confirm"
                          role="alertdialog"
                          aria-label="Unlock this question?"
                        >
                          <span style={{ flex: 1, minWidth: 180 }}>
                            Unlock this question? Any solver will be able to
                            lock it.
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
                      ) : (
                        <>
                          <span className="lb-note">
                            <span className="tag gold">
                              <Lock size={12} />
                              Locked by you
                            </span>
                            <span>
                              You can unlock until you submit the solution.
                            </span>
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
                      )
                    ) : question.status === "assigned" &&
                      !mine &&
                      isAdminSolver(user?.role) ? (
                      <>
                        <span className="lb-note">
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Lock size={14} />
                            Locked by{" "}
                            {shortName(
                              question.solver?.name ?? "another solver",
                            )}
                          </span>
                          <span>
                            As an admin solver you can take this lock over.
                          </span>
                        </span>
                        <span className="lb-actions">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              run(
                                () => override.trigger({ id }),
                                `You took over question #${id}.`,
                              )
                            }
                          >
                            <ShieldCheck size={14} />
                            Override lock
                          </button>
                        </span>
                      </>
                    ) : (
                      <span className="lb-note">
                        <Lock size={14} />
                        {mine
                          ? "You answered this question"
                          : `Locked by ${shortName(question.solver?.name ?? "another solver")}`}
                      </span>
                    )}
                  </div>
                </section>
              )}

              {isAdminSolver(user?.role) && (
                <section
                  className="panel solve-box tools"
                  aria-labelledby="tools-h"
                >
                  <h2
                    className="h3"
                    id="tools-h"
                    style={{
                      fontSize: 20,
                      margin: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Shield size={18} aria-hidden="true" />
                    Admin solver tools
                  </h2>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                    You can delete this question, delete any solution, follow-up
                    or comment, and take over locks held by other solvers.
                  </p>
                  {confirmDelete ? (
                    <div
                      className="confirm"
                      role="alertdialog"
                      aria-label="Delete this question?"
                    >
                      <span style={{ flexBasis: "100%" }}>
                        Delete this question for everyone? This can't be undone.
                      </span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={async () => {
                          await run(
                            () => removeQuestion.trigger({ id }),
                            `Question #${id} was deleted.`,
                          );
                          navigate("/questions");
                        }}
                      >
                        <Trash2 size={14} />
                        Delete question
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ justifySelf: "start" }}
                      onClick={() => setConfirmDelete(true)}
                    >
                      <Trash2 size={14} />
                      Delete question
                    </button>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------- solution ---------- */

function SolutionSection({
  questionId,
  question,
  loggedIn,
  isAssignedSolver,
  canModerate,
}: {
  questionId: number;
  question: {
    status: string;
    solution?: unknown;
    solver?: { id: string; name: string } | null;
  };
  loggedIn: boolean;
  isAssignedSolver: boolean;
  canModerate: boolean;
}) {
  const flash = useToast();
  const submit = useSubmitSolution(questionId);
  const remove = useDeleteSolution(questionId);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [confirming, setConfirming] = useState(false);

  const solution = question.solution as
    | {
        text: string | null;
        imageUrl: string | null;
        audioUrl: string | null;
        audioSeconds: number | null;
        createdAt: string;
      }
    | null
    | undefined;

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

      {!loggedIn ? (
        <div className="locked">
          <Lock size={22} aria-hidden="true" />
          <strong>Log in to see the solution</strong>
          <p className="muted" style={{ margin: 0, maxWidth: "32em" }}>
            Solutions and follow-ups are visible to registered students and
            solvers.
          </p>
          <div
            className="cta"
            style={{ justifyContent: "center", marginTop: 8 }}
          >
            <Link className="btn btn-primary btn-sm" to="/login">
              Student login
            </Link>
            <Link className="btn btn-ghost btn-sm" to="/login/solver">
              Solver login
            </Link>
          </div>
        </div>
      ) : solution ? (
        <article className="panel solution">
          <div className="sol-h">
            {question.solver && (
              <Link className="sol-who" to={`/solvers/${question.solver.id}`}>
                <Avatar name={question.solver.name} size={40} />
                <span className="sw-txt">
                  <b>{isAssignedSolver ? "You" : question.solver.name}</b>
                  <span className="muted">{ago(solution.createdAt)}</span>
                </span>
                <ChevronRight
                  size={18}
                  aria-hidden="true"
                  className="sw-chev"
                />
              </Link>
            )}
            {(canModerate || isAssignedSolver) && !confirming && (
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
            <div
              className="confirm"
              role="alertdialog"
              aria-label="Delete this solution?"
            >
              <span style={{ flex: 1, minWidth: 220 }}>
                Delete this solution? The rating and follow-ups are cleared.
              </span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  setConfirming(false);
                  try {
                    await remove.trigger();
                    flash("Solution deleted.");
                  } catch (e) {
                    flash(e instanceof Error ? e.message : "Couldn't delete");
                  }
                }}
              >
                Delete solution
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirming(false)}
              >
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
              Solutions can't be edited. To change it, delete it and submit a
              new one.
            </p>
          )}
        </article>
      ) : question.status === "waiting" ? (
        <div className="panel" style={{ display: "grid", gap: 10 }}>
          <p
            className="muted"
            style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}
          >
            <Clock size={16} aria-hidden="true" />
            No solution yet. The question is open for any solver to lock.
          </p>
        </div>
      ) : isAssignedSolver ? (
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
              onClick={async () => {
                if (!text.trim()) {
                  setErr("Add the solution text before submitting.");
                  return;
                }
                try {
                  await submit.trigger({ text: text.trim() });
                  setText("");
                  flash("Solution submitted. The asker has been notified.");
                } catch (e) {
                  setErr(e instanceof Error ? e.message : "Couldn't submit");
                }
              }}
            >
              <Send size={15} />
              Submit solution
            </button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <p
            className="muted"
            style={{ margin: 0, display: "flex", gap: 8, alignItems: "center" }}
          >
            <Clock size={16} aria-hidden="true" />
            {shortName(question.solver?.name ?? "A solver")} locked this
            question and is working on the solution.
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------- rating ---------- */

function RatingSection({
  questionId,
  status,
}: {
  questionId: number;
  status: string;
}) {
  const rate = useRateQuestion(questionId);
  const flash = useToast();

  const set = async (value: "satisfied" | "unsatisfied") => {
    try {
      await rate.trigger({ value });
      flash("Rating saved");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't save rating");
    }
  };

  return (
    <section className="section panel" aria-labelledby="rate-h">
      <h2 className="h3" id="rate-h">
        Did this answer clear your doubt?
      </h2>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        Your rating is shown on the question and counts toward the solver's
        record. You can change it later.
      </p>
      <div className="rate">
        <button
          type="button"
          className="yes"
          aria-pressed={status === "satisfied"}
          onClick={() => set("satisfied")}
        >
          <i aria-hidden="true" />
          Satisfied
        </button>
        <button
          type="button"
          className="no"
          aria-pressed={status === "unsatisfied"}
          onClick={() => set("unsatisfied")}
        >
          <i aria-hidden="true" />
          Not satisfied
        </button>
      </div>
    </section>
  );
}

/* ---------- thread ---------- */

function ThreadSection({
  questionId,
  loggedIn,
  hasSolution,
  canPost,
  canModerate,
  askerName,
  solverName,
}: {
  questionId: number;
  loggedIn: boolean;
  hasSolution: boolean;
  canPost: boolean;
  canModerate: boolean;
  askerName: string;
  solverName: string;
}) {
  const { data } = useSWR(
    loggedIn && hasSolution ? threadKey(questionId) : null,
    () => fetchThread(questionId),
    { revalidateOnFocus: false },
  );
  const post = usePostThreadMessage(questionId);
  const flash = useToast();
  const [text, setText] = useState("");

  const messages = data?.messages ?? [];

  return (
    <section className="section" aria-labelledby="thread-h">
      <div className="section-h">
        <div>
          <h2 className="h3" id="thread-h">
            Follow-up thread
          </h2>
          <p>
            Follow-up conversation about the solution. Only{" "}
            {shortName(askerName)} and the solver can post here; other students
            can read along.
          </p>
        </div>
      </div>

      {!loggedIn ? (
        <div className="locked">
          <Lock size={22} aria-hidden="true" />
          <strong>Log in to read the follow-up thread</strong>
        </div>
      ) : (
        <div className="panel">
          {!hasSolution ? (
            <p className="muted" style={{ margin: 0 }}>
              The follow-up thread opens once the solver submits a solution.
            </p>
          ) : (
            <div className="thread">
              {messages.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>
                  No follow-up messages yet.
                </p>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`msg ${m.authorSide}`}>
                  <div className="msg-h">
                    <b>
                      {m.authorSide === "solver"
                        ? shortName(solverName)
                        : shortName(askerName)}
                    </b>
                    <span>
                      {m.authorSide === "solver" ? "Solver" : "Asker"}
                    </span>
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
              ))}
            </div>
          )}

          {hasSolution && canPost && (
            <div className="composer">
              <label className="field">
                <span>Write a message</span>
                <textarea
                  className="textarea"
                  style={{ minHeight: 90 }}
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
                  onClick={async () => {
                    if (!text.trim()) return;
                    try {
                      await post.trigger({ text: text.trim() });
                      setText("");
                      flash("Message sent");
                    } catch (e) {
                      flash(e instanceof Error ? e.message : "Couldn't send");
                    }
                  }}
                >
                  <Send size={15} />
                  Send
                </button>
              </div>
            </div>
          )}
          {hasSolution && !canPost && (
            <p className="muted" style={{ margin: "16px 0 0", fontSize: 14 }}>
              You can read this thread. To join the discussion, use the comments
              below.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- comments ---------- */

function CommentsSection({
  questionId,
  canComment,
  loggedIn,
  canModerate,
}: {
  questionId: number;
  canComment: boolean;
  loggedIn: boolean;
  canModerate: boolean;
}) {
  const { data } = useSWR(
    commentsKey(questionId),
    () => fetchComments(questionId),
    {
      revalidateOnFocus: false,
    },
  );
  const post = usePostComment(questionId);
  const flash = useToast();
  const [text, setText] = useState("");

  const comments = data?.comments ?? [];

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
        {comments.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No comments yet. Start the discussion.
          </p>
        ) : (
          <div>
            {comments.map((c) => (
              <div className="comment" key={c.id}>
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
          {canComment ? (
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
                  onClick={async () => {
                    if (!text.trim()) return;
                    try {
                      await post.trigger({ text: text.trim() });
                      setText("");
                      flash("Comment posted");
                    } catch (e) {
                      flash(e instanceof Error ? e.message : "Couldn't post");
                    }
                  }}
                >
                  <MessageSquare size={15} />
                  Post comment
                </button>
              </div>
            </>
          ) : loggedIn ? (
            <p className="muted" style={{ margin: 0 }}>
              Comments are for students. Reply to the asker in the thread above.
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              <Link className="btn btn-text" to="/login">
                Log in as a student to comment.
              </Link>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ---------- report ---------- */

function ReportBox({ questionId }: { questionId: number }) {
  const create = useCreateReport(questionId);
  const flash = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const send = async () => {
    if (!reason) {
      setErr("Choose what the problem is.");
      return;
    }
    if (text.trim().length < 10) {
      setErr(
        "Write at least 10 characters so the admins understand the problem.",
      );
      return;
    }
    try {
      await create.trigger({ reason, text: text.trim() });
      setOpen(false);
      setReason("");
      setText("");
      setErr("");
      flash("Report sent to the admins.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't send the report");
    }
  };

  return (
    <section className="section panel report-box" aria-labelledby="report-h">
      <div>
        <h2
          className="h3"
          id="report-h"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <Flag size={18} aria-hidden="true" />
          Report a problem to the admins
        </h2>
        <p className="muted" style={{ margin: 0, fontSize: 15 }}>
          If the solution is wrong or something else went wrong, tell the
          Achieve Doubts admins. Only admins see reports.
        </p>
      </div>

      {open ? (
        <div style={{ display: "grid", gap: 14 }}>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              What's the problem?
            </legend>
            <div className="reason-list">
              {REPORT_REASONS.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name={`reason-${questionId}`}
                    value={value}
                    checked={reason === value}
                    onChange={() => {
                      setReason(value);
                      setErr("");
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Details</span>
            <textarea
              className="textarea"
              style={{ minHeight: 90 }}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setErr("");
              }}
            />
            <small>Explain what's wrong so an admin can check it.</small>
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
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setOpen(false);
                setErr("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={send}
            >
              <Flag size={14} />
              Send report
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ justifySelf: "start" }}
          onClick={() => setOpen(true)}
        >
          <Flag size={14} />
          Report a problem
        </button>
      )}
    </section>
  );
}

export function ErrorBoundary() {
  return (
    <main id="main" className="page">
      <div className="wrap">
        <Gate
          icon={<AlertTriangle size={24} />}
          title="This question doesn't exist or was removed."
        >
          <Link className="btn btn-primary" to="/questions">
            Back to questions
          </Link>
        </Gate>
      </div>
    </main>
  );
}
