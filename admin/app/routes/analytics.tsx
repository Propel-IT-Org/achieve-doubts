import { AlertTriangle } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/analytics";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { CardsSkeleton, Skeleton } from "~/components/skeleton";
import {
  AnalyticsFilters,
  AnalyticsFiltersPlaceholder,
} from "~/features/analytics/analytics-filters";
import { AnalyticsCharts, AnalyticsMetrics } from "~/features/analytics/analytics-report";
import { RANGE_ERROR, RangePicker, useRange } from "~/features/analytics/range-picker";
import { SolverRankings } from "~/features/analytics/solver-rankings";
import { daysAgo, isoDay } from "~/lib/format";
import {
  analyticsKey,
  fetchAnalytics,
  fetchSolvers,
  fetchTaxonomy,
  solversKey,
  taxonomyKey,
} from "~/lib/queries";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Analytics — Achieve Doubts admin" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const filters = {
    from: params.get("from") ?? daysAgo(29),
    to: params.get("to") ?? isoDay(),
    subject: params.get("subject") ?? "",
    solver: params.get("solver") ?? "",
  };
  preload(taxonomyKey(), fetchTaxonomy);
  preload(solversKey(), fetchSolvers);
  if (filters.from <= filters.to) {
    preload(analyticsKey(filters), () => fetchAnalytics(filters));
  }
  return null;
}

export default function AnalyticsPage() {
  const { from, to, invalid, params } = useRange();
  const subject = params.get("subject") ?? "";
  const filters = { from, to, subject, solver: params.get("solver") ?? "" };

  return (
    <>
      <PageHeader title="Analytics" sub="Activity across subjects and solvers for any date range." />

      <div className="toolbar">
        <RangePicker />
        <AsyncBoundary fallback={<AnalyticsFiltersPlaceholder />} errorText="Couldn't load the filters.">
          <AnalyticsFilters />
        </AsyncBoundary>
      </div>

      {invalid ? (
        <div className="err" role="alert" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          {RANGE_ERROR}
        </div>
      ) : (
        <>
          <AsyncBoundary
            fallback={<Skeleton height={110} radius={16} style={{ marginBottom: 24 }} />}
            errorText="Couldn't load the figures for this range."
          >
            <AnalyticsMetrics filters={filters} />
          </AsyncBoundary>
          <AsyncBoundary fallback={<CardsSkeleton count={3} />} errorText="Couldn't load the charts.">
            <AnalyticsCharts filters={filters} />
          </AsyncBoundary>
          <SolverRankings range={{ from, to, subject }} />
        </>
      )}
    </>
  );
}
