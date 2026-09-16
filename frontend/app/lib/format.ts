/**
 * Copy + formatting helpers, ported from the prototype's `useLang` hook.
 * The interface is English; user content (questions, answers, comments)
 * stays in whatever language it was written in.
 */

const MIN = 60 * 1000;

export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0]} ${parts[parts.length - 1][0]}.`
    : parts[0];
}

export function initials(full: string): string {
  return full
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function ago(ts: string | number | Date): string {
  const time = new Date(ts).getTime();
  const m = Math.floor((Date.now() - time) / MIN);
  if (m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}

export function formatDate(ts: string | number | Date): string {
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Minutes -> "42 min" / "1 hr 12 min". */
export function dur(minutes: number | null | undefined): string {
  if (minutes == null) return "–";
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} hr ${m % 60} min`;
}

/** Seconds -> "m:ss". */
export function clock(sec: number | null | undefined): string {
  if (sec == null) return "–";
  return `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}`;
}

/** A 0..1 rate -> "94%". Null (no ratings yet) renders as an en dash. */
export function pct(rate: number | null | undefined): string {
  if (rate == null) return "–";
  return `${Math.round(rate * 100)}%`;
}

export function ratio(a: number, b: number): string {
  return b ? `${Math.round((a / b) * 100)}%` : "–";
}

export function fmt(n: number): string {
  return Number(n).toLocaleString("en-US");
}

export const STATUS_LABEL: Record<string, string> = {
  waiting: "Open",
  assigned: "Solver assigned",
  answered: "Answered",
  satisfied: "Solved",
  unsatisfied: "Not satisfied",
};

export const ANSWERED_STATUSES = ["answered", "satisfied", "unsatisfied"];
