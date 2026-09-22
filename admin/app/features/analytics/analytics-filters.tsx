import { useSolvers, useTaxonomyTree } from "~/lib/queries";
import { useRange } from "./range-picker";

/** Subject and solver selects. Suspends on the taxonomy and solver list. */
export function AnalyticsFilters() {
  const levels = useTaxonomyTree();
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
          {/* Grouped by the API: subject names repeat across classes. */}
          {levels.map((level) => (
            <optgroup key={level.id} label={level.nameEn}>
              {level.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEn}
                </option>
              ))}
            </optgroup>
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
