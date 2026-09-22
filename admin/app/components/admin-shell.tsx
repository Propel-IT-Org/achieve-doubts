import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import {
  BarChart3,
  FileSpreadsheet,
  Flag,
  GraduationCap,
  Library,
  LogOut,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useReports } from "~/lib/queries";
import { type SessionUser, signOut } from "~/lib/session";
import { AsyncBoundary } from "./async-boundary";
import { Avatar, Brand } from "./primitives";

const PAGES: Array<{ to: string; label: string; icon: LucideIcon }> = [
  { to: "/", label: "Reports", icon: Flag },
  { to: "/students", label: "Students", icon: Users },
  { to: "/solvers", label: "Solvers", icon: UserCheck },
  { to: "/batches", label: "Batches", icon: GraduationCap },
  { to: "/taxonomy", label: "Taxonomy", icon: Library },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/invoice", label: "Invoice", icon: FileSpreadsheet },
];

/** Which nav entry a path belongs to: /solvers/new is still "Solvers". */
function sectionOf(pathname: string) {
  return PAGES.find((p) => p.to !== "/" && pathname.startsWith(p.to))?.to ?? "/";
}

function useOpenReports(): number {
  return useReports().filter((r) => r.status === "open").length;
}

function SideCount() {
  const n = useOpenReports();
  return n > 0 ? (
    <span className="adm-count" aria-label={`${n} open reports`}>
      {n}
    </span>
  ) : null;
}

function BottomBadge() {
  const n = useOpenReports();
  return n > 0 ? (
    <span className="badge" aria-hidden="true">
      {n}
    </span>
  ) : null;
}

function BottomBadgeLabel() {
  const n = useOpenReports();
  return n > 0 ? <span className="sr">, {n} open reports</span> : null;
}

/**
 * The admin panel frame: navy sidebar on desktop, navy top bar and dark
 * bottom nav on phones. The open-report count loads on its own, so the
 * frame never waits for it.
 */
export function AdminShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = sectionOf(pathname);

  const go = (to: string) => {
    navigate(to);
    window.scrollTo(0, 0);
  };

  const leave = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="adm">
      <div className="adm-mtop">
        <Brand onClick={() => go("/")} />
        <span className="ttl">Admin panel</span>
        <span className="who">
          <Avatar name={user.name} size={34} />
          <button type="button" className="icon-btn" aria-label="Sign out" onClick={leave}>
            <LogOut size={18} />
          </button>
        </span>
      </div>

      <aside className="adm-side">
        <div className="adm-brand">
          <Brand onClick={() => go("/")} />
          <small>Admin panel</small>
        </div>
        <nav className="adm-nav" aria-label="Admin panel">
          {PAGES.map(({ to, label, icon: Icon }) => (
            <button
              key={to}
              type="button"
              aria-current={current === to ? "page" : undefined}
              onClick={() => go(to)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
              {to === "/" && (
                <AsyncBoundary fallback={null} errorFallback={null}>
                  <SideCount />
                </AsyncBoundary>
              )}
            </button>
          ))}
        </nav>
        <div className="adm-foot" lang="en">
          {typeof window === "undefined" ? "" : window.location.host}
        </div>
      </aside>

      <div>
        <div className="adm-top">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <Avatar name={user.name} size={30} />
            {user.name}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={leave}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
        <main id="main" className="adm-body">
          {children}
        </main>
      </div>

      <nav className="bnav dark" aria-label="Admin navigation">
        {PAGES.map(({ to, label, icon: Icon }) => (
          <button
            key={to}
            type="button"
            aria-current={current === to ? "page" : undefined}
            onClick={() => go(to)}
          >
            <span className="bn-ic">
              <Icon size={22} aria-hidden="true" />
              {to === "/" && (
                <AsyncBoundary fallback={null} errorFallback={null}>
                  <BottomBadge />
                </AsyncBoundary>
              )}
            </span>
            <span className="bn-l">
              {label}
              {to === "/" && (
                <AsyncBoundary fallback={null} errorFallback={null}>
                  <BottomBadgeLabel />
                </AsyncBoundary>
              )}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** The page title block every admin page opens with. */
export function PageHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="ph">
      <h1>{title}</h1>
      <p>{sub}</p>
    </div>
  );
}
