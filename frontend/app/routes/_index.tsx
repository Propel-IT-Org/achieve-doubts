import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { LogIn, Pause, Play } from "lucide-react";
import useSWR, { preload } from "swr";

import type { Route } from "./+types/_index";
import {
  fetchHomeStats,
  fetchQuestions,
  fetchSubjects,
  homeStatsKey,
  questionsKey,
  subjectsKey,
  swrConfig,
} from "~/lib/queries";
import { clock, dur, fmt, pct } from "~/lib/format";
import { useSession } from "~/lib/session";
import { prefersReducedMotion } from "~/components/primitives";
import { buildTaxonomyLookup, QuestionCard } from "~/components/question-card";

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

const HERO_FILTERS = { limit: 1 } as const;

export async function clientLoader(_: Route.ClientLoaderArgs) {
  // Start all three requests before the component renders.
  preload(homeStatsKey(), fetchHomeStats);
  preload(subjectsKey(), fetchSubjects);
  preload(questionsKey(HERO_FILTERS), () => fetchQuestions(HERO_FILTERS));
  return null;
}

const SEQ = ["waiting", "assigned", "answered", "satisfied"];

const STEPS: Array<[string, string]> = [
  [
    "Asked",
    "Photograph the problem, choose the subject, book and chapter, and say what you've already tried.",
  ],
  [
    "Matched",
    "Every solver can see your question. The first one to lock it becomes your solver, and can unlock it if they can't help.",
  ],
  [
    "Answered",
    "Your solver submits a solution with worked steps, an image or an audio note. Follow-up questions go in a separate thread, and other students can discuss in the comments.",
  ],
  [
    "Rated",
    "Mark the answer satisfied, or mark it not satisfied to keep the thread open for a follow-up.",
  ],
];

function BigTrace() {
  const ref = useRef<HTMLDivElement>(null);
  const rectRef = useRef<SVGRectElement>(null);
  const [go, setGo] = useState(false);

  useEffect(() => {
    const reveal = () => {
      setGo(true);
      rectRef.current?.setAttribute("width", "440");
    };
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      reveal();
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          reveal();
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const xs = [12, 152, 292, 432, 552];
  const a = 9;
  let d = `M${xs[0]} 36 C ${xs[0] + 47} ${36 - a}, ${xs[0] + 93} ${36 + a}, ${xs[1]} 36`;
  for (let i = 2; i < xs.length; i++) {
    const seg = xs[i] - xs[i - 1];
    d += ` S ${xs[i] - seg / 3} ${36 + (i % 2 === 0 ? -a : a)}, ${xs[i]} 36`;
  }

  return (
    <div ref={ref} className={`bigtrace${go ? " go" : ""}`}>
      <svg viewBox="0 26 560 20" aria-hidden="true" focusable="false">
        <title>How a question moves</title>
        <defs>
          <clipPath id="acs-bigtrace-clip">
            <rect ref={rectRef} x="0" y="0" width="0" height="80" />
          </clipPath>
        </defs>
        <path className="tr-pend" d={d} />
        <path className="tr-done" clipPath="url(#acs-bigtrace-clip)" d={d} />
        {xs.slice(0, 4).map((x, i) => (
          <use
            key={x}
            href="#acs-star"
            className={`tr-m m${i + 1}${i === 3 ? " fin" : ""}`}
            transform={`translate(${x} 36) scale(.9)`}
          />
        ))}
      </svg>
    </div>
  );
}

function HeroCard() {
  const { data } = useSWR(
    questionsKey(HERO_FILTERS),
    () => fetchQuestions(HERO_FILTERS),
    swrConfig,
  );
  const { data: subjects } = useSWR(subjectsKey(), fetchSubjects, swrConfig);

  const [idx, setIdx] = useState(1);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => setIdx((i) => (i + 1) % SEQ.length), 2800);
    return () => clearInterval(iv);
  }, [playing]);

  const question = data?.items[0];
  if (!question || !subjects) return null;

  const taxonomy = buildTaxonomyLookup(subjects);

  return (
    <div>
      <div className="demo-cap">
        <span>How your question moves once you post it</span>
        {!prefersReducedMotion() && (
          <button
            type="button"
            className="play"
            aria-pressed={!playing}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={11} /> : <Play size={11} />}
            {playing ? "Pause" : "Play"}
          </button>
        )}
      </div>
      <QuestionCard
        question={question}
        taxonomy={taxonomy}
        statusOverride={SEQ[idx]}
      />
    </div>
  );
}

function StatsBand() {
  const { data } = useSWR(homeStatsKey(), fetchHomeStats, swrConfig);
  if (!data) return null;

  return (
    <section className="stats-band" aria-label="Achieve Doubts in numbers">
      <div className="wrap">
        <div className="stats4">
          <div className="stat">
            <div className="v">{fmt(data.solved)}</div>
            <div className="l">questions solved so far</div>
          </div>
          <div className="stat">
            <div className="v">
              {data.medianMatchSeconds != null
                ? `${Math.round(data.medianMatchSeconds)} s`
                : "–"}
            </div>
            <div className="l">typical wait until a solver takes your question</div>
          </div>
          <div className="stat">
            <div className="v">{dur(data.medianAnswerMinutes)}</div>
            <div className="l">typical time to a full answer</div>
          </div>
          <div className="stat">
            <div className="v">{pct(data.satisfactionRate)}</div>
            <div className="l">of answers marked satisfied</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OnlineCount() {
  const { data } = useSWR(homeStatsKey(), fetchHomeStats, swrConfig);
  return (
    <div className="online">
      <i aria-hidden="true" />
      {data?.solversAvailable ?? 0} solvers available now
    </div>
  );
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
            <OnlineCount />
          </div>
          <HeroCard />
        </div>
      </section>

      <StatsBand />

      <section className="how" id="how" aria-labelledby="how-h">
        <div className="wrap">
          <h2 className="h2" id="how-h">
            How a question moves
          </h2>
          <p className="muted" style={{ margin: 0, maxWidth: "40em", fontSize: 17 }}>
            Every question follows the same four steps, and you can see which one
            yours has reached.
          </p>
          <BigTrace />
          <div className="steps4">
            {STEPS.map(([heading, body]) => (
              <div className="step" key={heading}>
                <h3>
                  <svg className="step-star" viewBox="-8 -8 16 16" aria-hidden="true">
                    <title>{heading}</title>
                    <use href="#acs-star" />
                  </svg>
                  {heading}
                </h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
