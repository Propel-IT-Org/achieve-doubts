import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

/**
 * A sortable column heading. `aria-sort` goes on the <th>, so a screen
 * reader announces the state with the column rather than with the button.
 */
export function SortHeader({
  label,
  active,
  dir,
  onSort,
  numeric,
  width,
}: {
  label: string;
  active: boolean;
  /** The direction this column would apply when pressed. */
  dir: SortDir;
  onSort: () => void;
  numeric?: boolean;
  width?: number;
}) {
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      className={numeric ? "num" : undefined}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      style={width ? { width } : undefined}
    >
      <button type="button" className="th-sort" onClick={onSort}>
        {label}
        <Icon size={13} aria-hidden="true" className={active ? "" : "faint"} />
      </button>
    </th>
  );
}

/** How a value is read out of a row for comparison. Null sorts last. */
export type SortAccessors<T> = Record<string, (row: T) => string | number | null>;

/**
 * Client-side sorting, for lists that arrive whole (solvers, batches, the
 * invoice). A paged list must be sorted by the API instead — see the
 * students page.
 */
export function useSortedRows<T>(
  rows: T[],
  accessors: SortAccessors<T>,
  initial?: { key: string; dir: SortDir },
) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(initial ?? null);

  const sorted = useMemo(() => {
    const read = sort && accessors[sort.key];
    if (!sort || !read) return rows;

    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = read(a);
      const right = read(b);
      // "No value" is not a low value: those rows stay at the bottom.
      if (left === null || left === "") return right === null || right === "" ? 0 : 1;
      if (right === null || right === "") return -1;
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right), "en") * factor;
    });
  }, [rows, sort, accessors]);

  /** Press once for the column's natural direction, again to reverse it. */
  const toggle = (key: string, natural: SortDir = "asc") =>
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: natural },
    );

  const headerProps = (key: string, natural: SortDir = "asc") => ({
    active: sort?.key === key,
    dir: sort?.key === key ? sort.dir : natural,
    onSort: () => toggle(key, natural),
  });

  return { rows: sorted, sort, toggle, headerProps };
}
