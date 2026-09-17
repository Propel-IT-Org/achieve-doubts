import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "~/components/primitives";

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

/** The long progress line that draws itself when scrolled into view. */
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

export function HowItWorks() {
  return (
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
  );
}
