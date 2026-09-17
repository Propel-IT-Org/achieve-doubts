import { useNavigate } from "react-router";
import { Plus } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/solvers";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { SolverCount, SolverTable } from "~/features/solvers/solver-table";
import { fetchSolvers, solversKey } from "~/lib/queries";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Solvers — Achieve Doubts admin" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(solversKey(), fetchSolvers);
  return null;
}

export default function SolversPage() {
  const navigate = useNavigate();

  return (
    <>
      <PageHeader
        title="Solvers"
        sub="Add solvers, grant admin solver powers and deactivate accounts."
      />
      <div className="toolbar">
        <span className="muted" style={{ fontSize: 14 }}>
          <AsyncBoundary fallback={null} errorFallback={null}>
            <SolverCount />
          </AsyncBoundary>
        </span>
        <button type="button" className="btn btn-primary" onClick={() => navigate("/solvers/new")}>
          <Plus size={16} />
          Add solver
        </button>
      </div>
      <AsyncBoundary fallback={<PanelSkeleton lines={6} />} errorText="Couldn't load solvers.">
        <SolverTable />
      </AsyncBoundary>
    </>
  );
}
