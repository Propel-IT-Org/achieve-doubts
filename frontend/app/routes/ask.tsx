import { Link } from "react-router";
import { Lock, User } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/ask";
import { fetchTaxonomy, taxonomyKey } from "~/lib/queries";
import { useSession } from "~/lib/session";
import { Gate } from "~/components/primitives";
import { AskForm } from "~/features/ask/ask-form";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Ask a question — Achieve Doubts" }];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  preload(taxonomyKey(), fetchTaxonomy);
  return null;
}

export default function AskPage() {
  const { user, isPending } = useSession();

  if (isPending) return null;

  if (!user) {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<Lock size={24} />}
            title="Log in to continue"
            text="Log in as a student to ask a question."
          >
            <Link className="btn btn-primary" to="/login">
              Student login
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  if (user.role !== "student") {
    return (
      <main id="main" className="page">
        <div className="wrap">
          <Gate
            icon={<User size={24} />}
            title="Ask a question"
            text="Only students can ask questions. Switch to a student account to use this page."
          >
            <Link className="btn btn-ghost" to="/questions">
              Questions
            </Link>
          </Gate>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="page">
      <div className="wrap" style={{ maxWidth: 820 }}>
        <div className="ph">
          <h1>Ask a question</h1>
          <p>
            Your question goes to the next online solver. Add a photo if the
            problem has a diagram or working.
          </p>
        </div>
        <AskForm />
      </div>
    </main>
  );
}
