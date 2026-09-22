import { Link } from "react-router";
import { Lock } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/solver";
import { dashboardKey, fetchDashboard, fetchTaxonomy, taxonomyKey } from "~/lib/queries";
import { isSolver, useSession } from "~/lib/session";
import { AsyncBoundary } from "~/components/async-boundary";
import { Avatar, Gate } from "~/components/primitives";
import { CardsSkeleton, Skeleton } from "~/components/skeleton";
import {
  FollowupsPanel,
  LockedByMePanel,
  RecentlySolved,
} from "~/features/solver/dashboard-panels";
import { DashboardMetrics, FindOrBlocked } from "~/features/solver/dashboard-summary";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Solver dashboard — Achieve Doubts" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(taxonomyKey(), fetchTaxonomy);
  preload(dashboardKey(), fetchDashboard);
  return null;
}

export default function SolverDashboard() {
  const { user, isPending } = useSession();

  if (isPending) return null;

  if (!user || !isSolver(user.role)) {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<Lock size={24} />}
            title="Solver dashboard"
            text="This page is for solvers. Log in with a solver account to see it."
          >
            <Link className="btn btn-primary" to="/login/solver">
              Solver login
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="page">
      <div className="wrap">
        <div className="prof" style={{ marginBottom: 24 }}>
          <Avatar name={user.name} size={64} />
          <div>
            <h1 style={{ fontSize: "clamp(30px,4vw,42px)" }}>Solver dashboard</h1>
            <div className="prof-meta">
              <span>{user.name}</span>
              {user.role === "adminSolver" && <span className="tag gold">Admin solver</span>}
            </div>
          </div>
        </div>

        <AsyncBoundary
          fallback={<Skeleton height={120} radius={16} style={{ marginBottom: 28 }} />}
          errorText="Couldn't load your dashboard."
        >
          <DashboardMetrics />
          <FindOrBlocked />
        </AsyncBoundary>

        <div className="two">
          <LockedByMePanel />
          <FollowupsPanel />
        </div>

        <h2 className="h2">Recently solved</h2>
        <AsyncBoundary fallback={<CardsSkeleton count={2} />} errorText="Couldn't load recent answers.">
          <RecentlySolved />
        </AsyncBoundary>
      </div>
    </main>
  );
}
