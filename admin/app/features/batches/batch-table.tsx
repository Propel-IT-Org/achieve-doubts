import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ActiveTag } from "~/components/primitives";
import { formatDate } from "~/lib/format";
import { useSetBatchActive } from "~/lib/mutations";
import { type BatchRow, useBatches } from "~/lib/queries";

export function BatchCount() {
  const batches = useBatches();
  const active = batches.filter((b) => b.active).length;
  return (
    <>
      {batches.length} batches, {active} active
    </>
  );
}

export function BatchTable() {
  const batches = useBatches();
  const setActive = useSetBatchActive();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const change = async (batch: BatchRow, active: boolean) => {
    try {
      const { affectedStudents } = await setActive.trigger({ id: batch.id, active });
      const students =
        affectedStudents === 1 ? "1 student" : `${affectedStudents} students`;
      toast(
        active
          ? `${batch.label} is active again. ${students} can sign in.`
          : `${batch.label} is deactivated. ${students} can no longer sign in.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the batch");
    }
  };

  if (!batches.length) {
    return (
      <div className="empty">
        <p style={{ margin: 0 }}>
          No batches yet. Add the ones Achieve sends, or their students can't sign in.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrap stack-wrap">
      <table className="tbl stack" style={{ minWidth: 720 }}>
        <thead>
          <tr>
            <th>Batch id</th>
            <th>Name</th>
            <th className="num">Students</th>
            <th className="num">Can sign in</th>
            <th>Added</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <Fragment key={b.id}>
              <tr className={b.active ? "" : "off"}>
                <td className="lead" style={{ whiteSpace: "nowrap" }}>
                  <b>{b.id}</b>
                </td>
                <td data-label="Name">{b.label}</td>
                <td className="num" data-label="Students">
                  {b.students}
                </td>
                <td className="num" data-label="Can sign in">
                  {b.activeStudents}
                </td>
                <td data-label="Added" style={{ whiteSpace: "nowrap" }}>
                  {formatDate(b.createdAt)}
                </td>
                <td data-label="Status">
                  <ActiveTag active={b.active} />
                </td>
                <td className="acts" style={{ minWidth: 130 }}>
                  {b.active ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      aria-expanded={confirmId === b.id}
                      onClick={() => setConfirmId(confirmId === b.id ? null : b.id)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={setActive.isMutating}
                      onClick={() => change(b, true)}
                    >
                      Reactivate
                    </button>
                  )}
                </td>
              </tr>
              {confirmId === b.id && (
                <tr className="confirm-row">
                  <td colSpan={7}>
                    <ConfirmDeactivateBatch
                      batch={b}
                      busy={setActive.isMutating}
                      onConfirm={() => {
                        setConfirmId(null);
                        void change(b, false);
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

/**
 * Deactivating a batch deactivates its students too, so the confirmation
 * says how many. Students deactivated on their own stay that way when the
 * batch comes back.
 */
function ConfirmDeactivateBatch({
  batch,
  busy,
  onConfirm,
  onCancel,
}: {
  batch: BatchRow;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const students =
    batch.activeStudents === 1 ? "1 student" : `${batch.activeStudents} students`;
  const text = `Deactivate ${batch.label}? ${students} will be signed out and can't sign in until it's active again.`;

  return (
    <div className="confirm" role="alertdialog" aria-label={text}>
      <span style={{ flex: 1, minWidth: 220 }}>{text}</span>
      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onConfirm}>
        Confirm
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
