import { Outlet, redirect, useNavigate } from "react-router";
import { ShieldAlert } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/_panel";
import { AdminShell } from "~/components/admin-shell";
import { Gate } from "~/components/primitives";
import { fetchReports, reportsKey } from "~/lib/queries";
import { getSession, isStaff, signOut } from "~/lib/session";

/**
 * Gate for every admin page. No session: off to sign-in. A student or solver
 * session (shared with the main site) isn't enough — the API would refuse
 * every call anyway, so say so plainly instead of showing empty pages.
 */
export async function clientLoader(_: Route.ClientLoaderArgs) {
  const user = await getSession();
  if (!user) throw redirect("/login");
  // The sidebar badge counts open reports on every page.
  if (isStaff(user)) preload(reportsKey(), fetchReports);
  return { user };
}

export default function Panel({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const navigate = useNavigate();

  if (!isStaff(user)) {
    return (
      <main id="main" className="adm-login">
        <div className="adm-login-in">
          <div className="panel">
            <Gate
              icon={<ShieldAlert size={24} />}
              title="Not an admin account"
              text={`You're signed in as ${user.email}, which can't use the admin panel. Sign out, then sign in with an admin account.`}
            >
              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await signOut();
                  navigate("/login", { replace: true });
                }}
              >
                Sign out
              </button>
            </Gate>
          </div>
        </div>
      </main>
    );
  }

  return (
    <AdminShell user={user}>
      <Outlet />
    </AdminShell>
  );
}
