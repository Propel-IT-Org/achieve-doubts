import { useEffect, useState } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { mutate } from "swr";
import { questionKey } from "~/lib/queries";

/** Under this much time left, the countdown turns into a warning. */
const WARN_SECONDS = 2 * 60;

/**
 * The sweeper returns expired locks to the feed every 30 seconds
 * (backend jobs/lock-sweeper.ts), so this waits a little longer than that
 * before re-reading the question.
 */
const RECHECK_AFTER_EXPIRY_MS = 35_000;

const mmss = (seconds: number) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * How long the solver holding this lock has left to answer. A lock lasts
 * LOCK_TIMEOUT_MINUTES (15 by default); once it expires any solver can take
 * the question, so the holder should see the clock rather than discover it
 * by losing the question.
 */
export function LockCountdown({
  questionId,
  expiresAt,
}: {
  questionId: number;
  expiresAt: string | null;
}) {
  const deadline = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const [remaining, setRemaining] = useState(() => (deadline - Date.now()) / 1000);

  useEffect(() => {
    if (Number.isNaN(deadline)) return;
    setRemaining((deadline - Date.now()) / 1000);
    const tick = setInterval(() => setRemaining((deadline - Date.now()) / 1000), 1000);
    return () => clearInterval(tick);
  }, [deadline]);

  // Once it runs out, re-read the question: by then the sweeper has usually
  // released it, and the panel should say so rather than offer a dead lock.
  useEffect(() => {
    if (Number.isNaN(deadline)) return;
    const wait = deadline - Date.now() + RECHECK_AFTER_EXPIRY_MS;
    const timer = setTimeout(
      () => void mutate(questionKey(questionId)),
      Math.max(0, wait),
    );
    return () => clearTimeout(timer);
  }, [deadline, questionId]);

  if (Number.isNaN(deadline)) return null;

  if (remaining <= 0) {
    return (
      <span className="lb-note" style={{ color: "var(--coral-ink)" }}>
        <AlertTriangle size={14} aria-hidden="true" />
        Your lock has expired. Another solver can take this question now.
      </span>
    );
  }

  // role="timer" keeps screen readers from announcing every second; the
  // warning below is what actually needs saying.
  return (
    <span
      role="timer"
      className={remaining <= WARN_SECONDS ? "tag off" : "tag"}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      <Clock size={12} aria-hidden="true" />
      {mmss(remaining)} left to answer
    </span>
  );
}
