import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Search } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/students";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { StudentDrawer } from "~/features/students/student-drawer";
import {
  StudentCount,
  StudentPager,
  StudentTable,
} from "~/features/students/student-table";
import {
  fetchStudents,
  type StudentQuery,
  type StudentSort,
  studentsKey,
} from "~/lib/queries";
import { useDebounced } from "~/lib/use-debounced";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Students — Achieve Doubts admin" }];
}

/** The search, sort and page live in the URL, so a view can be shared. */
function queryFromParams(params: URLSearchParams): StudentQuery {
  const sort = params.get("sort");
  const dir = params.get("dir");
  return {
    q: params.get("q") ?? "",
    sort: (["recent", "name", "asked", "satisfaction"] as const).includes(sort as StudentSort)
      ? (sort as StudentSort)
      : "recent",
    dir: dir === "asc" || dir === "desc" ? dir : undefined,
    page: Math.max(1, Number(params.get("page") ?? 1) || 1),
  };
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const query = queryFromParams(new URL(request.url).searchParams);
  preload(studentsKey(query), () => fetchStudents(query));
  return null;
}

export default function StudentsPage() {
  const [params, setParams] = useSearchParams();
  const query = queryFromParams(params);

  const [input, setInput] = useState(query.q);
  // One search per pause in typing, not per keystroke; the previous results
  // stay on screen meanwhile (keepPreviousData).
  const search = useDebounced(input.trim());
  const [selected, setSelected] = useState<string | null>(null);

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // A new search starts at the first page, or it could land past the end.
  useEffect(() => {
    if (search !== query.q) update({ q: search || undefined, page: undefined });
  }, [search, query.q, update]);

  const sortBy = (sort: StudentSort) => {
    const natural = sort === "name" ? "asc" : "desc";
    const flipped = (query.dir ?? natural) === "asc" ? "desc" : "asc";
    const dir = query.sort === sort ? flipped : natural;
    update({
      sort: sort === "recent" && dir === "desc" ? undefined : sort,
      dir: dir === natural ? undefined : dir,
      page: undefined,
    });
  };

  const close = useCallback(() => {
    const id = selected;
    setSelected(null);
    // Return focus to the row that opened the drawer.
    setTimeout(() => document.getElementById(`stu-btn-${id}`)?.focus(), 0);
  }, [selected]);

  return (
    <>
      <PageHeader title="Students" sub="Search students and open a full record." />

      <div className="toolbar">
        <label className="field" style={{ maxWidth: 420 }}>
          <span className="sr">Search by name, college or district</span>
          <span className="search">
            <Search size={16} aria-hidden="true" />
            <input
              className="input"
              type="search"
              placeholder="Search by name, college or district"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </span>
        </label>
        <span className="muted" style={{ fontSize: 14 }} aria-live="polite">
          <AsyncBoundary fallback={null} errorFallback={null}>
            <StudentCount query={query} />
          </AsyncBoundary>
        </span>
      </div>

      <AsyncBoundary fallback={<PanelSkeleton lines={8} />} errorText="Couldn't load students.">
        <StudentTable
          query={query}
          selected={selected}
          onOpen={setSelected}
          onSort={sortBy}
        />
        <StudentPager query={query} onPage={(page) => update({ page: String(page) })} />
      </AsyncBoundary>

      {selected && <StudentDrawer id={selected} onClose={close} />}
    </>
  );
}
