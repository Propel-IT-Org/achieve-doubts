import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ActiveTag, ConfirmDeactivate } from "~/components/primitives";
import { fmt, pct } from "~/lib/format";
import { useSetSolverActive, useSetSolverAdmin } from "~/lib/mutations";
import { type SolverRow, solverCredentials, useSolvers } from "~/lib/queries";

/** A solver holding this many open follow-ups can't lock new questions. */
const FOLLOWUP_BLOCK = 3;

export function SolverCount() {
  const solvers = useSolvers();
  const active = solvers.filter((s) => !s.banned).length;
  return (
    <>
      {solvers.length} solvers, {active} active
    </>
  );
}

export function SolverTable() {
  const solvers = useSolvers();
  const setActive = useSetSolverActive();
  const setAdmin = useSetSolverAdmin();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const changeActive = async (s: SolverRow, active: boolean) => {
    try {
      await setActive.trigger({ id: s.id, active });
      toast(active ? `${s.name} was reactivated.` : `${s.name} was deactivated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the account");
    }
  };

  const changeAdmin = async (s: SolverRow) => {
    const isAdminSolver = !s.isAdminSolver;
    try {
      await setAdmin.trigger({ id: s.id, isAdminSolver });
      toast(
        isAdminSolver
          ? `${s.name} is now an admin solver.`
          : `${s.name} is no longer an admin solver.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the role");
    }
  };

  if (!solvers.length) {
    return (
      <div className="empty">
        <p style={{ margin: 0 }}>No solvers yet. Add the first one.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap stack-wrap">
      <table className="tbl stack" style={{ minWidth: 760 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Institution</th>
            <th>Status</th>
            <th className="num">Answered</th>
            <th className="num">Satisfaction</th>
            <th className="num">Open follow-ups</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {solvers.map((s) => (
            <Fragment key={s.id}>
              <tr>
                <td className="lead">
                  <b>{s.name}</b> {s.isAdminSolver && <span className="tag gold">Admin solver</span>}
                  <div className="muted" style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>
                    {s.email}
                  </div>
                  {s.phone && (
                    <div className="muted tnum" style={{ fontSize: 12.5 }}>
                      {s.phone}
                    </div>
                  )}
                </td>
                <td data-label="Institution">{solverCredentials(s) || "–"}</td>
                <td data-label="Status">
                  <ActiveTag active={!s.banned} />
                </td>
                <td className="num" data-label="Answered">
                  {fmt(s.solved)}
                </td>
                <td className="num" data-label="Satisfaction">
                  {pct(s.satisfactionRate)}
                </td>
                <td className="num" data-label="Open follow-ups">
                  <span className={s.pendingFollowups >= FOLLOWUP_BLOCK ? "tag off" : ""}>
                    {s.pendingFollowups}
                  </span>
                </td>
                <td className="acts" style={{ minWidth: 130 }}>
                  <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {s.banned ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={setActive.isMutating}
                        onClick={() => changeActive(s, true)}
                      >
                        Reactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        aria-expanded={confirmId === s.id}
                        onClick={() => setConfirmId(confirmId === s.id ? null : s.id)}
                      >
                        Deactivate
                      </button>
                    )}
                    {/* The page promises "grant admin solver powers"; the
                        prototype's table has no control for it, so it lives
                        here beside the account action. */}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={setAdmin.isMutating}
                      aria-pressed={s.isAdminSolver}
                      onClick={() => changeAdmin(s)}
                    >
                      {s.isAdminSolver ? "Remove admin" : "Make admin"}
                    </button>
                  </span>
                </td>
              </tr>
              {confirmId === s.id && (
                <tr className="confirm-row">
                  <td colSpan={7}>
                    <ConfirmDeactivate
                      name={s.name}
                      busy={setActive.isMutating}
                      onConfirm={() => {
                        setConfirmId(null);
                        void changeActive(s, false);
                      }}
                      onCancel={() => setConfirmId(null)}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
