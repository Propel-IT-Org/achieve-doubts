import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ActiveTag, ConfirmDeactivate } from "~/components/primitives";
import { SortHeader } from "~/components/table-sort";
import { formatDate, share } from "~/lib/format";
import { useSetStudentActive } from "~/lib/mutations";
import {
  STUDENTS_PAGE_SIZE,
  type StudentQuery,
  type StudentRow,
  type StudentSort,
  useStudents,
} from "~/lib/queries";

/** "{n} students, {a} active" — lives beside the search box. */
export function StudentCount({ query }: { query: StudentQuery }) {
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
  onSort,
}: {
  query: StudentQuery;
  selected: string | null;
  onOpen: (id: string) => void;
  /** Sorting is the API's job here: only one page is loaded. */
  onSort: (sort: StudentSort) => void;
}) {
  const { students } = useStudents(query);
  const { run, busy } = useStudentActivation();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Pressing the sorted column again reverses it; a new column starts in the
  // direction the API uses by default for it.
  const sortable = (key: StudentSort, label: string, numeric?: boolean) => {
    const natural = key === "name" ? "asc" : "desc";
    const active = query.sort === key;
    return (
      <SortHeader
        label={label}
        numeric={numeric}
        active={active}
        dir={active ? (query.dir ?? natural) : natural}
        onSort={() => onSort(key)}
      />
    );
  };

  if (!students.length) {
    return (
      <div className="table-wrap stack-wrap">
        <div style={{ padding: 28, textAlign: "center" }} className="muted">
          {query.q ? `No students match "${query.q}".` : "No students yet."}
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
            {sortable("name", "Name")}
            <th>College</th>
            <th>District</th>
            {sortable("asked", "Questions", true)}
            {sortable("satisfaction", "Satisfaction", true)}
            {sortable("recent", "Joined")}
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

/** Prev/Next over the API's offset, with the range this page covers. */
export function StudentPager({
  query,
  onPage,
}: {
  query: StudentQuery;
  onPage: (page: number) => void;
}) {
  const { students, total } = useStudents(query);
  if (total <= STUDENTS_PAGE_SIZE) return null;

  const first = (query.page - 1) * STUDENTS_PAGE_SIZE + 1;
  const last = first + students.length - 1;
  const pages = Math.max(1, Math.ceil(total / STUDENTS_PAGE_SIZE));

  return (
    <div className="pager">
      <span aria-live="polite">
        Showing {first}–{last} of {total}
      </span>
      <span className="spacer">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={query.page <= 1}
          onClick={() => onPage(query.page - 1)}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={query.page >= pages}
          onClick={() => onPage(query.page + 1)}
        >
          Next
        </button>
      </span>
    </div>
  );
}
