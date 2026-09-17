import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { AsyncBoundary } from "~/components/async-boundary";
import { ActiveTag, Avatar, ConfirmDeactivate } from "~/components/primitives";
import { PanelSkeleton } from "~/components/skeleton";
import { formatDate, share } from "~/lib/format";
import { useStudent } from "~/lib/queries";
import { useStudentActivation } from "./student-table";

/**
 * The full student record, as a modal side sheet. Escape or the backdrop
 * closes it; focus moves to the close button and body scroll is locked
 * while it's open.
 */
export function StudentDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  // Focus lands on whichever close button is showing: the loading one, then
  // the loaded one.
  // Stable, so a re-render doesn't pull focus back to the button.
  const focusOnMount = useCallback((el: HTMLButtonElement | null) => el?.focus(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <>
      <div className="drawer-bg" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="stu-h">
        <AsyncBoundary
          fallback={
            <>
              <div className="drawer-h">
                <div className="who">
                  <small>Student record</small>
                  <h2 id="stu-h">Loading…</h2>
                </div>
                <button type="button" ref={focusOnMount} className="icon-btn" aria-label="Close" onClick={onClose}>
                  <X size={16} />
                </button>
              </div>
              <div className="drawer-b">
                <PanelSkeleton lines={5} />
              </div>
            </>
          }
          errorText="Couldn't load this student."
        >
          <StudentRecord
            id={id}
            closeButton={
              <button type="button" ref={focusOnMount} className="icon-btn" aria-label="Close" onClick={onClose}>
                <X size={16} />
              </button>
            }
          />
        </AsyncBoundary>
      </aside>
    </>
  );
}

function StudentRecord({ id, closeButton }: { id: string; closeButton: React.ReactNode }) {
  const { user, student_profiles: profile, stats } = useStudent(id);
  const { run, busy } = useStudentActivation();
  const [confirming, setConfirming] = useState(false);
  const active = !user.banned;

  useEffect(() => setConfirming(false), [id]);

  const place = [profile?.hscYear ? `HSC ${profile.hscYear}` : null, profile?.college, profile?.district]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <div className="drawer-h">
        <Avatar name={user.name} size={52} />
        <div className="who">
          <small>Student record</small>
          <h2 id="stu-h">{user.name}</h2>
          {place && <p>{place}</p>}
        </div>
        {closeButton}
      </div>
      <div className="drawer-b">
        <section className="acct" aria-label="Account">
          <div className="acct-row">
            <ActiveTag active={active} />
            {!confirming &&
              (active ? (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>
                  Deactivate
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => run(user, true)}
                >
                  Reactivate
                </button>
              ))}
          </div>
          {confirming && (
            <ConfirmDeactivate
              wide
              name={user.name}
              busy={busy}
              onConfirm={() => {
                setConfirming(false);
                void run(user, false);
              }}
              onCancel={() => setConfirming(false)}
            />
          )}
          {!active && (
            <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>
              This student can't log in. Their questions, comments and reports stay visible.
            </p>
          )}
        </section>
        <dl className="facts">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className="tnum">{profile?.phone ?? "–"}</dd>
          </div>
          <div>
            <dt>Questions asked</dt>
            <dd>{stats.asked}</dd>
          </div>
          <div>
            <dt>Satisfaction rate</dt>
            <dd>
              {stats.satisfied + stats.unsatisfied
                ? share(stats.satisfied, stats.satisfied + stats.unsatisfied)
                : "No ratings yet"}
            </dd>
          </div>
          <div>
            <dt>Joined</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
