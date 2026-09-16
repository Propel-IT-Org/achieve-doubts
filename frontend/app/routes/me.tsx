import { Link, Navigate } from "react-router";
import { Lock } from "lucide-react";

import type { Route } from "./+types/me";
import { isSolver, useSession } from "~/lib/session";
import { Gate } from "~/components/primitives";

export function meta(_: Route.MetaArgs) {
  return [{ title: "My profile — Achieve Doubts" }];
}

/**
 * `/me` is a convenience redirect to whichever public profile belongs to the
 * signed-in account, so the header and bottom nav can link somewhere stable.
 */
export default function MyProfile() {
  const { user, isPending } = useSession();

  if (isPending) return null;

  if (!user) {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<Lock size={24} />}
            title="Log in to continue"
            text="Log in to see your profile."
          >
            <Link className="btn btn-primary" to="/login">
              Student login
            </Link>
            <Link className="btn btn-ghost" to="/login/solver">
              Solver login
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  return (
    <Navigate
      to={isSolver(user.role) ? `/solvers/${user.id}` : `/students/${user.id}`}
      replace
    />
  );
}
