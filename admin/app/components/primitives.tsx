import { STATUS_LABEL, initials } from "~/lib/format";

/** Inline SVG defs the prototype references by id (the star marker). */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <title>Shared icon definitions</title>
      <defs>
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
    <button type="button" className="brand" onClick={onClick} aria-label="Achieve Doubts">
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

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill s-${status}`}>
      <i aria-hidden="true" />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

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

/** Active / Deactivated account tag. */
export function ActiveTag({ active }: { active: boolean }) {
  return <span className={`tag ${active ? "on" : "off"}`}>{active ? "Active" : "Deactivated"}</span>;
}

/** Inline "Deactivate X?" confirmation, shared by every account list. */
export function ConfirmDeactivate({
  name,
  busy,
  onConfirm,
  onCancel,
  wide,
}: {
  name: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Put the question on its own line (drawer layout). */
  wide?: boolean;
}) {
  const text = `Deactivate ${name}? They won't be able to log in.`;
  return (
    <div className="confirm" role="alertdialog" aria-label={text}>
      <span style={wide ? { flexBasis: "100%" } : { flex: 1, minWidth: 220 }}>{text}</span>
      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onConfirm}>
        Confirm
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
