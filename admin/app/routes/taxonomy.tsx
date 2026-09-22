import { preload } from "swr";

import type { Route } from "./+types/taxonomy";
import { PageHeader } from "~/components/admin-shell";
import { AsyncBoundary } from "~/components/async-boundary";
import { PanelSkeleton } from "~/components/skeleton";
import { TaxonomyTree } from "~/features/taxonomy/taxonomy-tree";
import { fetchTaxonomy, taxonomyKey } from "~/lib/queries";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Taxonomy — Achieve Doubts admin" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(taxonomyKey(), fetchTaxonomy);
  return null;
}

export default function TaxonomyPage() {
  return (
    <>
      <PageHeader
        title="Taxonomy"
        sub="Class > subject > book > chapter. A student sees the class their batch is on, and files every question under one of its chapters."
      />

      <AsyncBoundary
        fallback={<PanelSkeleton lines={8} />}
        errorText="Couldn't load the taxonomy."
      >
        <TaxonomyTree />
      </AsyncBoundary>
    </>
  );
}
