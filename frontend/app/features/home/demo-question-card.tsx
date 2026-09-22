import { useEffect, useState } from "react";
import { Pause, Play } from "lucide-react";
import { prefersReducedMotion } from "~/components/primitives";
import { QuestionCardView } from "~/components/question-card";

/** The order the demo card cycles through. */
const SEQ = ["waiting", "assigned", "answered", "satisfied"];

const INK = "#2f343c";

/** The prototype's inclined-plane sketch, standing in for a real photo. */
function InclineSketch() {
  return (
    <svg className="qc-thumb" viewBox="0 0 80 60" role="img" aria-label="1 photo">
      <rect width="80" height="60" fill="url(#acs-ph)" />
      <path
        d="M8 50 L72 50 L8 18 Z"
        fill="none"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect
        x="-6"
        y="-4"
        width="12"
        height="8"
        transform="translate(41 30) rotate(26.57)"
        fill="#e9e6df"
        stroke={INK}
        strokeWidth="1.3"
      />
      <path d="M62 50 A10 10 0 0 0 63 45.6" fill="none" stroke={INK} strokeWidth="1" />
      <text x="52" y="47" fontSize="6" fill={INK} fontFamily="sans-serif">
        30°
      </text>
      <text x="36" y="21" fontSize="5.5" fill={INK} fontFamily="sans-serif">
        2kg
      </text>
    </svg>
  );
}

/**
 * A scripted example, not a real question: it walks one made-up card through
 * the four steps so a visitor sees how a question moves. Every value here is
 * fixed, and the card leads to the real list.
 */
export function DemoQuestionCard() {
  const [idx, setIdx] = useState(1);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!playing) return;
    const iv = setInterval(() => setIdx((i) => (i + 1) % SEQ.length), 2800);
    return () => clearInterval(iv);
  }, [playing]);

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
      <QuestionCardView
        to="/questions"
        status={SEQ[idx]}
        levelName="Class 11–12 (HSC)"
        subjectName="Physics"
        bookName="Physics 1st paper"
        chapterNumber={4}
        chapterName="Newtonian mechanics"
        text="30° কোণে আনত একটি ঘর্ষণহীন তলের শীর্ষ থেকে 2 kg ভরের একটি ব্লক স্থির অবস্থা থেকে ছেড়ে দেওয়া হলো। তলের দৈর্ঘ্য 5 m হলে পাদদেশে পৌঁছাতে কত সময় লাগবে? আমি 1.01 s পাচ্ছি, বইয়ের উত্তর 1.43 s। কোথায় ভুল করছি?"
        photo={<InclineSketch />}
        askerName="Tasnim Rahman"
        solverName="Rafid Hasan"
        solverCredentials="BUET Mechanical ’24"
        when="45 min ago"
        commentCount={4}
      />
    </div>
  );
}
