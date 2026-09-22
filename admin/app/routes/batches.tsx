import { useState } from "react";
import { Plus } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/batches";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { AddBatchForm } from "~/features/batches/add-batch-form";
import { BatchCount, BatchTable } from "~/features/batches/batch-table";
import { batchesKey, fetchBatches, fetchLevels, levelsKey } from "~/lib/queries";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Batches — Achieve Doubts admin" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(batchesKey(), fetchBatches);
  // The add and edit forms both offer the class list.
  preload(levelsKey(), fetchLevels);
  return null;
}

export default function BatchesPage() {
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="Batches"
        sub="Achieve sends a batch with every student sign-in. Only batches listed and active here can sign in."
      />

      <div className="toolbar">
        <span className="muted" style={{ fontSize: 14 }}>
          <AsyncBoundary fallback={null} errorFallback={null}>
            <BatchCount />
          </AsyncBoundary>
        </span>
        {!adding && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add batch
          </button>
        )}
      </div>

      {adding && (
        <div style={{ maxWidth: 780, marginBottom: 24 }}>
          <AsyncBoundary
            fallback={<PanelSkeleton lines={4} />}
            errorText="Couldn't load the class list."
          >
            <AddBatchForm onDone={() => setAdding(false)} />
          </AsyncBoundary>
        </div>
      )}

      <AsyncBoundary fallback={<PanelSkeleton lines={6} />} errorText="Couldn't load batches.">
        <BatchTable />
      </AsyncBoundary>
    </>
  );
}
