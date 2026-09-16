import { Link } from "react-router";
import { User } from "lucide-react";

import type { Route } from "./+types/login";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Student login — Achieve Doubts" }];
}

/**
 * Students never sign in here. They arrive already authenticated through the
 * Achieve SSO handshake: Achieve's backend calls our integration endpoint,
 * we mint a one-time token, and the student lands with a session cookie
 * already set. There is deliberately no student password anywhere in the
 * system, so this page explains the route in rather than offering a form.
 */
export default function StudentLogin() {
  return (
    <main id="main" className="page">
      <div className="wrap">
        <div className="auth">
          <div className="ph" style={{ marginBottom: 20 }}>
            <span className="auth-kind">
              <User size={16} aria-hidden="true" />
              Student
            </span>
            <h1>Student login</h1>
            <p>Students reach Achieve Doubts from their Achieve course dashboard.</p>
          </div>

          <div className="panel">
            <p className="muted" style={{ margin: 0 }}>
              Open your course on Achieve and press <b>Doubt Solve</b>. You'll be
              signed in here automatically — there's no separate password to
              remember.
            </p>

            <div className="ok" role="status">
              Already signed in on another tab? Your session carries over.
            </div>

            <Link className="btn btn-ghost" to="/questions">
              Browse questions as a guest
            </Link>

            <Link className="btn btn-text" to="/login/solver">
              Solver? Use solver login
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
