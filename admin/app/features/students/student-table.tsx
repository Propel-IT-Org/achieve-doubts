import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ActiveTag, ConfirmDeactivate } from "~/components/primitives";
import { formatDate, share } from "~/lib/format";
import { useSetStudentActive } from "~/lib/mutations";
import { type StudentRow, useStudents } from "~/lib/queries";

/** "{n} students, {a} active" — lives beside the search box. */
export function StudentCount({ query }: { query: string }) {
  const { total, active } = useStudents(query);
  return (
    <>
      {total} students, {active} active
    </>
  );
}

/** Deactivate (with confirmation) or reactivate one student. */
export function useStudentActivation() {
  const setActive = useSetStudentActive();
  const run = async (student: { id: string; name: string }, active: boolean) => {
    try {
      await setActive.trigger({ id: student.id, active });
      toast(active ? `${student.name} was reactivated.` : `${student.name} was deactivated.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change the account");
    }
  };
  return { run, busy: setActive.isMutating };
}

export function StudentTable({
  query,
  selected,
  onOpen,
}: {
  query: string;
  selected: string | null;
  onOpen: (id: string) => void;
}) {
  const { students } = useStudents(query);
  const { run, busy } = useStudentActivation();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (!students.length) {
    return (
      <div className="table-wrap stack-wrap">
        <div style={{ padding: 28, textAlign: "center" }} className="muted">
          {query ? `No students match "${query}".` : "No students yet."}
        </div>
      </div>
    );
  }

  const actionCell = (s: StudentRow) =>
    s.banned ? (
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          void run(s, true);
        }}
      >
        Reactivate
      </button>
    ) : (
      <button
        type="button"
        className="btn btn-danger btn-sm"
        aria-expanded={confirmId === s.id}
        onClick={(e) => {
          e.stopPropagation();
          setConfirmId(confirmId === s.id ? null : s.id);
        }}
      >
        Deactivate
      </button>
    );

  return (
    <div className="table-wrap stack-wrap">
      <table className="tbl stack" style={{ minWidth: 860 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>College</th>
            <th>District</th>
            <th className="num">Questions</th>
            <th className="num">Satisfaction</th>
            <th>Joined</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <Fragment key={s.id}>
              <tr
                className={`click${selected === s.id ? " sel" : ""}${s.banned ? " off" : ""}`}
                onClick={() => onOpen(s.id)}
              >
                <td className="lead" style={{ whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    id={`stu-btn-${s.id}`}
                    className="rowbtn"
                    aria-haspopup="dialog"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(s.id);
                    }}
                  >
                    {s.name}
                  </button>
                  {s.hscYear && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      HSC {s.hscYear}
                    </div>
                  )}
                </td>
                <td data-label="College">{s.college ?? "–"}</td>
                <td data-label="District">{s.district ?? "–"}</td>
                <td className="num" data-label="Questions">
                  {s.asked}
                </td>
                <td className="num" data-label="Satisfaction">
                  {share(s.satisfied, s.satisfied + s.unsatisfied)}
                </td>
                <td data-label="Joined" style={{ whiteSpace: "nowrap" }}>
                  {formatDate(s.joinedAt)}
                </td>
                <td data-label="Status">
                  <ActiveTag active={!s.banned} />
                </td>
                <td className="acts" style={{ minWidth: 130 }}>
                  {actionCell(s)}
                </td>
              </tr>
              {confirmId === s.id && (
                <tr className="confirm-row">
                  <td colSpan={8}>
                    <ConfirmDeactivate
                      name={s.name}
                      busy={busy}
                      onConfirm={() => {
                        setConfirmId(null);
                        void run(s, false);
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
