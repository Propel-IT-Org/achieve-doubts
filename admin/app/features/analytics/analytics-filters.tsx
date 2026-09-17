import { useSolvers, useSubjects } from "~/lib/queries";
import { useRange } from "./range-picker";

/** Subject and solver selects. Suspends on the taxonomy and solver list. */
export function AnalyticsFilters() {
  const subjects = useSubjects();
  const solvers = useSolvers();
  const { params, set } = useRange();

  return (
    <div className="grp">
      <label className="field">
        <span>Subject</span>
        <select
          className="select"
          value={params.get("subject") ?? ""}
          onChange={(e) => set({ subject: e.target.value })}
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nameEn}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Solver</span>
        <select
          className="select"
          value={params.get("solver") ?? ""}
          onChange={(e) => set({ solver: e.target.value })}
        >
          <option value="">All solvers</option>
          {solvers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.banned ? " (deactivated)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function AnalyticsFiltersPlaceholder() {
  return (
    <div className="grp">
      {["Subject", "Solver"].map((label) => (
        <label className="field" key={label}>
          <span>{label}</span>
          <select className="select" disabled>
            <option>Loading…</option>
          </select>
        </label>
      ))}
    </div>
  );
}
