import { AlertTriangle } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/invoice";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { RANGE_ERROR, RangePicker, useRange } from "~/features/analytics/range-picker";
import {
  ExportButton,
  ExportButtonPlaceholder,
  InvoiceTable,
} from "~/features/invoice/invoice-table";
import { daysAgo, isoDay } from "~/lib/format";
import { fetchPayouts, fetchSolvers, payoutsKey, solversKey } from "~/lib/queries";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Invoice — Achieve Doubts admin" }];
}

export async function clientLoader({ request }: Route.ClientLoaderArgs) {
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? daysAgo(29);
  const to = params.get("to") ?? isoDay();
  preload(solversKey(), fetchSolvers);
  if (from <= to) preload(payoutsKey(from, to), () => fetchPayouts(from, to));
  return null;
}

export default function InvoicePage() {
  const { from, to, invalid } = useRange();

  return (
    <>
      <PageHeader title="Invoice" sub="Solver activity for the selected dates." />

      <div className="toolbar">
        <RangePicker />
        {invalid ? (
          <ExportButtonPlaceholder />
        ) : (
          <AsyncBoundary fallback={<ExportButtonPlaceholder />} errorFallback={<ExportButtonPlaceholder />}>
            <ExportButton from={from} to={to} />
          </AsyncBoundary>
        )}
      </div>

      {invalid ? (
        <div className="err" role="alert" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} />
          {RANGE_ERROR}
        </div>
      ) : (
        <AsyncBoundary fallback={<PanelSkeleton lines={8} />} errorText="Couldn't load the invoice figures.">
          <InvoiceTable from={from} to={to} />
        </AsyncBoundary>
      )}
    </>
  );
}
