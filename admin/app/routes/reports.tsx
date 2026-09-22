import { preload } from "swr";

import type { Route } from "./+types/reports";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { ReportList } from "~/features/reports/report-list";
import { fetchReports, fetchTaxonomy, reportsKey, taxonomyKey } from "~/lib/queries";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Reports — Achieve Doubts admin" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(reportsKey(), fetchReports);
  preload(taxonomyKey(), fetchTaxonomy);
  return null;
}

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        sub="Problems students reported after receiving a solution. Resolve a report once it's handled."
      />
      <AsyncBoundary fallback={<PanelSkeleton lines={6} />} errorText="Couldn't load reports.">
        <ReportList />
      </AsyncBoundary>
    </>
  );
}
