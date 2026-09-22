import { Fragment, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { ActiveTag } from "~/components/primitives";
import { type SortAccessors, SortHeader, useSortedRows } from "~/components/table-sort";
import { formatDate } from "~/lib/format";
import { useSetBatchActive, useUpdateBatch } from "~/lib/mutations";
import { type BatchRow, useBatches } from "~/lib/queries";
import { AsyncBoundary } from "~/components/async-boundary";
import { LevelOptions } from "./level-options";

const BATCH_SORTS: SortAccessors<BatchRow> = {
  id: (b) => b.id,
  label: (b) => b.label,
  level: (b) => b.levelName,
  students: (b) => b.students,
  active: (b) => b.activeStudents,
  added: (b) => Date.parse(b.createdAt),
};

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
  const { rows: batches, headerProps } = useSortedRows(useBatches(), BATCH_SORTS);
  const setActive = useSetBatchActive();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);

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
            <SortHeader label="Batch id" {...headerProps("id")} />
            <SortHeader label="Name" {...headerProps("label")} />
            <SortHeader label="Class" {...headerProps("level")} />
            <SortHeader label="Students" numeric {...headerProps("students", "desc")} />
            <SortHeader label="Can sign in" numeric {...headerProps("active", "desc")} />
            <SortHeader label="Added" {...headerProps("added", "desc")} />
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
                <td data-label="Class">
                  {b.levelName ?? <span className="muted">Not set</span>}
                </td>
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
                <td className="acts" style={{ minWidth: 190 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-expanded={editId === b.id}
                    onClick={() => {
                      setConfirmId(null);
                      setEditId(editId === b.id ? null : b.id);
                    }}
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
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
              {editId === b.id && (
                <tr className="confirm-row">
                  <td colSpan={8}>
                    <AsyncBoundary
                      fallback={<span className="muted">Loading classes…</span>}
                      errorText="Couldn't load the class list."
                    >
                      <EditBatchRow batch={b} onDone={() => setEditId(null)} />
                    </AsyncBoundary>
                  </td>
                </tr>
              )}
              {confirmId === b.id && (
                <tr className="confirm-row">
                  <td colSpan={8}>
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
 * The name and the class, edited in place. The id isn't editable: Achieve
 * sends it with every student sign-in, so changing it would lock the batch
 * out rather than rename it.
 *
 * Moving a batch to another class changes which syllabus its students may
 * ask against from their next page load; questions already asked keep the
 * taxonomy they were filed under.
 */
function EditBatchRow({ batch, onDone }: { batch: BatchRow; onDone: () => void }) {
  const update = useUpdateBatch();
  const [label, setLabel] = useState(batch.label);
  const [levelId, setLevelId] = useState(batch.levelId ?? "");

  const save = async () => {
    const trimmed = label.trim();
    if (!trimmed) {
      toast.error("Give the batch a name admins will recognise.");
      return;
    }
    try {
      await update.trigger({ id: batch.id, label: trimmed, levelId: levelId || null });
      toast(`${trimmed} saved.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the batch");
    }
  };

  return (
    <div className="confirm" role="group" aria-label={`Edit ${batch.label}`}>
      <label className="field" style={{ flex: 1, minWidth: 180 }}>
        <span>Name</span>
        <input
          className="input"
          value={label}
          autoComplete="off"
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <label className="field" style={{ flex: 1, minWidth: 180 }}>
        <span>Class</span>
        <select
          className="select"
          value={levelId}
          onChange={(e) => setLevelId(e.target.value)}
        >
          <option value="">No class yet</option>
          <LevelOptions />
        </select>
      </label>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={update.isMutating}
        onClick={save}
      >
        Save
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
        Cancel
      </button>
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
