import { useSearchParams } from "react-router";
import { AlertTriangle, X } from "lucide-react";

/**
 * Why an Achieve sign-in link didn't work. The backend's SSO endpoint sends
 * the student here with `?ssoError=<reason>` (achieve-sso-plugin.ts and
 * auth.router.ts) instead of showing a raw error, so this is the only place
 * they learn what happened and what to do.
 */
const REASONS: Record<string, { title: string; text: string }> = {
  expired_or_invalid: {
    title: "That sign-in link has expired",
    text: "Links from Achieve work once and only for a minute or so. Go back to Achieve and press Doubt Solve again.",
  },
  missing_token: {
    title: "That sign-in link is incomplete",
    text: "Go back to Achieve and press Doubt Solve again.",
  },
  account_disabled: {
    title: "Your account is deactivated",
    text: "You can't sign in to Achieve Doubts right now. If you think this is a mistake, contact Achieve support.",
  },
  rate_limited: {
    title: "Too many sign-in attempts",
    text: "Wait a minute, then go back to Achieve and press Doubt Solve again.",
  },
};

const FALLBACK = {
  title: "We couldn't sign you in",
  text: "Go back to Achieve and press Doubt Solve again.",
};

export function SsoErrorNotice() {
  const [params, setParams] = useSearchParams();
  const reason = params.get("ssoError");
  if (!reason) return null;

  const { title, text } = REASONS[reason] ?? FALLBACK;

  const dismiss = () => {
    const next = new URLSearchParams(params);
    next.delete("ssoError");
    setParams(next, { replace: true });
  };

  return (
    <div className="wrap" style={{ paddingTop: 16 }}>
      <div
        className="callout warn"
        role="alert"
        style={{ gridTemplateColumns: "auto minmax(0,1fr) auto" }}
      >
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Dismiss"
          onClick={dismiss}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
