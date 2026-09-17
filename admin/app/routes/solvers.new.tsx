import { Link } from "react-router";
import { ChevronLeft } from "lucide-react";

import type { Route } from "./+types/solvers.new";
import { PageHeader } from "~/components/admin-shell";
import { AddSolverForm } from "~/features/solvers/add-solver-form";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Add solver — Achieve Doubts admin" }];
}

export default function AddSolverPage() {
  return (
    <>
      <Link className="back" to="/solvers">
        <ChevronLeft size={16} />
        Back to solvers
      </Link>
      <PageHeader
        title="Add solver"
        sub="Create a solver account. The solver logs in on the main site with this username and password."
      />
      <AddSolverForm />
    </>
  );
}
