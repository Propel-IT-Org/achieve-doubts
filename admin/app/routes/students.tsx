import { useCallback, useState } from "react";
import { Search } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/students";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { StudentDrawer } from "~/features/students/student-drawer";
import { StudentCount, StudentTable } from "~/features/students/student-table";
import { fetchStudents, studentsKey } from "~/lib/queries";
import { useDebounced } from "~/lib/use-debounced";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Students — Achieve Doubts admin" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(studentsKey(""), () => fetchStudents(""));
  return null;
}

export default function StudentsPage() {
  const [input, setInput] = useState("");
  // One search per pause in typing, not per keystroke; the previous results
  // stay on screen meanwhile (keepPreviousData).
  const query = useDebounced(input.trim());
  const [selected, setSelected] = useState<string | null>(null);

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
        <StudentTable query={query} selected={selected} onOpen={setSelected} />
      </AsyncBoundary>

      {selected && <StudentDrawer id={selected} onClose={close} />}
    </>
  );
}
