import { Link } from "react-router";
import { LogIn } from "lucide-react";
import { preload } from "swr";

import type { Route } from "./+types/_index";
import { fetchHomeStats, homeStatsKey } from "~/lib/queries";
import { useSession } from "~/lib/session";
import { AsyncBoundary } from "~/components/async-boundary";
import { Skeleton } from "~/components/skeleton";
import { DemoQuestionCard } from "~/features/home/demo-question-card";
import { HowItWorks } from "~/features/home/how-it-works";
import { OnlineCount, StatsFigures } from "~/features/home/site-stats";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Achieve Doubts — Ask. Solve. Learn." },
    {
      name: "description",
      content:
        "Ask your doubts, connect with skilled solvers, and get the clarity you need to keep learning.",
    },
  ];
}

export async function clientLoader(_: Route.ClientLoaderArgs) {
  // The only live data on this page; the demo card is static.
  preload(homeStatsKey(), fetchHomeStats);
  return null;
}

export default function Home() {
  const { user } = useSession();
  const guest = !user;

  return (
    <main id="main">
      <section className="hero">
        <div className="wrap hero-in">
          <div>
            <h1 className="h1">
              <span className="l1">Ask. Solve. Learn.</span>{" "}
              <span className="l2">No doubt left unsolved</span>
            </h1>
            <p className="lede">
              Every difficult question has a way forward. Ask your doubts,
              connect with skilled solvers, and get the clarity you need to keep
              learning.
            </p>
            <div className="cta">
              {guest && (
                <Link className="btn btn-primary btn-lg" to="/login">
                  <LogIn size={18} />
                  Log in
                </Link>
              )}
              <Link
                className={`btn btn-lg ${guest ? "btn-ghost" : "btn-primary"}`}
                to="/questions"
              >
                Browse questions
              </Link>
            </div>
            <div className="online">
              <i aria-hidden="true" />
              <AsyncBoundary
                fallback={<Skeleton width={160} height={14} />}
                errorText="Solver count unavailable"
              >
                <OnlineCount />
              </AsyncBoundary>
            </div>
          </div>
          <DemoQuestionCard />
        </div>
      </section>

      <section className="stats-band" aria-label="Achieve Doubts in numbers">
        <div className="wrap">
          <AsyncBoundary
            fallback={<Skeleton height={88} />}
            errorText="Couldn't load the site figures."
          >
            <StatsFigures />
          </AsyncBoundary>
        </div>
      </section>

      <HowItWorks />
    </main>
  );
}
