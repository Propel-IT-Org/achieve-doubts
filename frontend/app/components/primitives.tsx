import { useEffect, useId, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { initials } from "~/lib/format";

/** Inline SVG defs the prototype references by id (star marker, photo fill). */
export function SvgDefs() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute" }}
      aria-hidden="true"
      focusable="false"
    >
      <title>Shared icon definitions</title>
      <defs>
        <radialGradient id="acs-ph" cx="45%" cy="40%" r="75%">
          <stop offset="0" stopColor="#E4E1DA" />
          <stop offset="1" stopColor="#A9A69E" />
        </radialGradient>
        <g id="acs-star">
          <rect x="-5" y="-5" width="10" height="10" />
          <rect x="-5" y="-5" width="10" height="10" transform="rotate(45)" />
        </g>
      </defs>
    </svg>
  );
}

export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      className="brand"
      onClick={onClick}
      aria-label="Achieve Doubts"
    >
      <svg viewBox="0 0 34 16" aria-hidden="true">
        <title>Achieve Doubts</title>
        <path className="bl" d="M2 8 C 7 3, 12 13, 21 8" />
        <use className="bs" href="#acs-star" transform="translate(27 8) scale(.75)" />
      </svg>
      <span>Achieve Doubts</span>
    </button>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

const STATUS_TEXT: Record<string, string> = {
  waiting: "Open",
  assigned: "Solver assigned",
  answered: "Answered",
  satisfied: "Solved",
  unsatisfied: "Not satisfied",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill s-${status}`}>
      <i aria-hidden="true" />
      {STATUS_TEXT[status] ?? status}
    </span>
  );
}

/* ---------- trace ---------- */

const TRACE_W: Record<string, number> = {
  waiting: 62,
  assigned: 180,
  answered: 340,
  satisfied: 560,
  unsatisfied: 340,
};
const REACH: Record<string, number[]> = {
  waiting: [1, 0, 0, 0],
  assigned: [1, 1, 0, 0],
  answered: [1, 1, 1, 0],
  satisfied: [1, 1, 1, 1],
  unsatisfied: [1, 1, 1, 0],
};
const TRACE_PATH =
  "M20 36 C 80 29, 120 43, 180 36 S 280 29, 340 36 S 440 43, 540 36";
const STEP_LABELS = ["Asked", "Matched", "Answered", "Rated"];

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function tweenAttr(el: SVGRectElement, to: number, duration = 750) {
  const from = Number.parseFloat(el.getAttribute("width") ?? "0") || 0;
  if (prefersReducedMotion() || Math.abs(from - to) < 0.5) {
    el.setAttribute("width", String(to));
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - p) ** 3;
    el.setAttribute("width", String(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function Trace({
  status,
  big,
  subs,
}: {
  status: string;
  big?: boolean;
  subs?: string[];
}) {
  const clipId = `tc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [initialWidth] = useState(() => TRACE_W[status] ?? 62);
  const rectRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    if (rectRef.current) tweenAttr(rectRef.current, TRACE_W[status] ?? 62);
  }, [status]);

  const reach = REACH[status] ?? REACH.waiting;
  const xs = [20, 180, 340, 540];

  return (
    <div className={`trace${big ? " big" : ""}`}>
      <svg viewBox="0 26 560 20" aria-hidden="true" focusable="false">
        <title>Question progress</title>
        <defs>
          <clipPath id={clipId}>
            <rect ref={rectRef} x="0" y="0" width={initialWidth} height="64" />
          </clipPath>
        </defs>
        <path className="tr-pend" d={TRACE_PATH} />
        <path className="tr-done" clipPath={`url(#${clipId})`} d={TRACE_PATH} />
        {status === "unsatisfied" && (
          <path className="tr-redo" d="M340 36 C 400 43, 440 43, 540 36" />
        )}
        {xs.map((x, i) =>
          i === 3 && status === "unsatisfied" ? (
            <path
              key={x}
              className="tr-x"
              d={`M${x - 5.5} 30.5 ${x + 5.5} 41.5M${x + 5.5} 30.5 ${x - 5.5} 41.5`}
            />
          ) : (
            <use
              key={x}
              href="#acs-star"
              className={`tr-m${reach[i] ? " on" : ""}${i === 3 ? " fin" : ""}`}
              transform={`translate(${x} 36) scale(.8)`}
            />
          ),
        )}
      </svg>
      <div className="tr-labs" aria-hidden={big ? undefined : "true"}>
        {STEP_LABELS.map((label, i) => {
          const cls =
            ["a", "b", "c", "d"][i] +
            (i === 3 && status === "unsatisfied"
              ? " bad"
              : reach[i]
                ? " on"
                : "");
          return (
            <span
              key={label}
              className={cls}
              style={big && (i === 1 || i === 2) ? { textAlign: "center" } : undefined}
            >
              {label}
              {subs && <em>{subs[i]}</em>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- voice note ---------- */

const WAVE = [
  6, 12, 18, 10, 22, 16, 8, 20, 24, 14, 9, 17, 21, 11, 7, 15, 19, 13, 6, 10, 16,
  22, 12, 8, 14, 18, 9, 5, 12, 16,
];

export function VoiceNote({ src, seconds }: { src?: string; seconds: number }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const bars = WAVE.map((h, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative waveform
    <i key={i} style={{ height: h }} />
  ));

  const toggle = () => {
    const el = audioRef.current;
    if (!el) {
      setPlaying((p) => !p);
      return;
    }
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
    setPlaying((p) => !p);
  };

  return (
    <div className={`voice${playing ? " playing" : ""}`}>
      {src && (
        // biome-ignore lint/a11y/useMediaCaption: user-recorded voice note
        <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} />
      )}
      <button
        type="button"
        className="vplay"
        aria-pressed={playing}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        onClick={toggle}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span className="wave" aria-hidden="true">
        {bars}
        <span
          className="prog"
          style={{ animationDuration: `${seconds}s` }}
          key={playing ? "p" : "s"}
          onAnimationEnd={() => setPlaying(false)}
        >
          {bars}
        </span>
      </span>
      <span className="len tnum">
        {Math.floor(seconds / 60)}:{String(Math.round(seconds) % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

/** Image + optional voice note, used by solutions, follow-ups and comments. */
export function Attachments({
  imageUrl,
  audioUrl,
  audioSeconds,
  label,
}: {
  imageUrl?: string | null;
  audioUrl?: string | null;
  audioSeconds?: number | null;
  label: string;
}) {
  return (
    <>
      {imageUrl && (
        <div className="attach-img">
          <img src={imageUrl} alt={label} />
        </div>
      )}
      {audioUrl && (
        <VoiceNote src={audioUrl} seconds={audioSeconds ?? 0} />
      )}
    </>
  );
}

/* ---------- misc ---------- */

export function Gate({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="gate">
      <div className="ic" aria-hidden="true">
        {icon}
      </div>
      <h1 className="h2">{title}</h1>
      {text && <p className="muted" style={{ margin: "0 0 20px" }}>{text}</p>}
      <div className="cta" style={{ justifyContent: "center" }}>
        {children}
      </div>
    </div>
  );
}

/** Closes a popover on outside click or Escape. */
export function useOutside(
  ref: React.RefObject<HTMLElement | null>,
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}
