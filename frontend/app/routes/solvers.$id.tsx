import { Link, useParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/solvers.$id";
import {
  fetchSolverProfile,
  fetchTaxonomy,
  solverProfileKey,
  taxonomyKey,
} from "~/lib/queries";
import { AsyncBoundary } from "~/components/async-boundary";
import { CardsSkeleton, Skeleton } from "~/components/skeleton";
import {
  SolverHeader,
  SolverMetrics,
  SolverRecentlySolved,
} from "~/features/profiles/solver-profile";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Solver profile — Achieve Doubts" }];
}

export async function clientLoader({ params }: Route.ClientLoaderArgs) {
  preload(taxonomyKey(), fetchTaxonomy);
  preload(solverProfileKey(params.id), () => fetchSolverProfile(params.id));
  return null;
}

export default function SolverProfilePage() {
  const { id = "" } = useParams();

  return (
    <main id="main" className="page">
      <div className="wrap">
        <Link className="back" to="/questions">
          <ChevronLeft size={16} />
          Back
        </Link>

        <AsyncBoundary
          fallback={<Skeleton height={180} radius={16} />}
          errorText="This solver profile doesn't exist."
        >
          <SolverHeader id={id} />
          <SolverMetrics id={id} />
        </AsyncBoundary>

        <h2 className="h2">Recently solved</h2>
        <AsyncBoundary fallback={<CardsSkeleton count={2} />} errorText="Couldn't load solved questions.">
          <SolverRecentlySolved id={id} />
        </AsyncBoundary>
      </div>
    </main>
  );
}
