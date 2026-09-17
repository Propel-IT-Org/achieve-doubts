import { useSearchParams } from "react-router";
import { daysAgo, isoDay } from "~/lib/format";

const PRESETS: Array<[number, string]> = [
  [7, "Last 7 days"],
  [30, "Last 30 days"],
  [90, "Last 90 days"],
];

/**
 * The date range, kept in the URL (`?from=&to=`) so a view can be
 * bookmarked or shared. Defaults to the last 30 days.
 */
export function useRange() {
  const [params, setParams] = useSearchParams();
  const today = isoDay();
  const from = params.get("from") ?? daysAgo(29);
  const to = params.get("to") ?? today;

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };

  return {
    from,
    to,
    today,
    /** A start after the end, or a blank input. Nothing is fetched then. */
    invalid: !from || !to || from > to,
    params,
    set,
  };
}

export function RangePicker() {
  const { from, to, today, set } = useRange();

  return (
    <div className="date-inputs">
      <div className="field">
        <span>Date range</span>
        <div className="seg" role="group" aria-label="Date range">
          {PRESETS.map(([days, label]) => {
            const start = daysAgo(days - 1);
            return (
              <button
                key={days}
                type="button"
                aria-pressed={from === start && to === today}
                onClick={() => set({ from: start, to: today })}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="field">
        <span>From</span>
        <input
          className="input"
          type="date"
          value={from}
          max={today}
          onChange={(e) => set({ from: e.target.value })}
        />
      </label>
      <label className="field">
        <span>To</span>
        <input
          className="input"
          type="date"
          value={to}
          max={today}
          onChange={(e) => set({ to: e.target.value })}
        />
      </label>
    </div>
  );
}

export const RANGE_ERROR = "The start date must be on or before the end date.";
