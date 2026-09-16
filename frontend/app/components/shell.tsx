import { useCallback, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  Bell,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessagesSquare,
  PlusCircle,
  User,
  UserCheck,
} from "lucide-react";
import { useSession, signOut, isSolver, type SessionUser } from "~/lib/session";
import { shortName } from "~/lib/format";
import { Avatar, Brand, useOutside } from "./primitives";

export function Header({ unread = 0 }: { unread?: number }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginOpen, setLoginOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const loginRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useOutside(loginRef, loginOpen, useCallback(() => setLoginOpen(false), []));
  useOutside(userRef, userOpen, useCallback(() => setUserOpen(false), []));

  const current = location.pathname.startsWith("/questions")
    ? "/questions"
    : location.pathname;

  const links: Array<[string, string]> = [];
  if (user?.role === "student") links.push(["/ask", "Ask a question"], ["/me", "My profile"]);
  if (isSolver(user?.role)) links.push(["/solver", "Dashboard"]);

  const go = (to: string) => {
    setUserOpen(false);
    setLoginOpen(false);
    navigate(to);
  };

  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Brand onClick={() => go("/")} />

        <nav className="nav" aria-label="Main navigation">
          {links.map(([to, label]) => (
            <button
              key={to}
              type="button"
              aria-current={current === to ? "page" : undefined}
              onClick={() => go(to)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="hdr-right">
          <button
            type="button"
            className="btn btn-ghost btn-sm hdr-q"
            aria-current={current === "/questions" ? "page" : undefined}
            onClick={() => go("/questions")}
          >
            Questions
          </button>

          {!user ? (
            <div className="pop-wrap" ref={loginRef}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-expanded={loginOpen}
                aria-haspopup="menu"
                onClick={() => setLoginOpen((o) => !o)}
              >
                Log in
              </button>
              {loginOpen && (
                <div className="pop" role="menu">
                  <button type="button" role="menuitem" onClick={() => go("/login")}>
                    <User size={16} />
                    Student login
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => go("/login/solver")}
                  >
                    <UserCheck size={16} />
                    Solver login
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                className="icon-btn hdr-bell"
                onClick={() => go("/notifications")}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
              >
                <Bell size={18} />
                {unread > 0 && (
                  <span className="badge" aria-hidden="true">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>

              <div className="pop-wrap" ref={userRef}>
                <button
                  type="button"
                  className="user-btn"
                  aria-expanded={userOpen}
                  aria-haspopup="menu"
                  aria-label={`Account menu: ${user.name}`}
                  onClick={() => setUserOpen((o) => !o)}
                >
                  <Avatar name={user.name} size={34} />
                  <span className="user-name">{shortName(user.name)}</span>
                </button>
                {userOpen && (
                  <div className="pop" role="menu">
                    <div className="who">
                      <b>{user.name}</b>
                      {roleLabel(user.role)}
                    </div>
                    {user.role === "student" && (
                      <button type="button" role="menuitem" onClick={() => go("/me")}>
                        <User size={16} />
                        My profile
                      </button>
                    )}
                    {isSolver(user.role) && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => go("/solver")}
                      >
                        <LayoutDashboard size={16} />
                        Dashboard
                      </button>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => go("/notifications")}
                    >
                      <Bell size={16} />
                      Notifications
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setUserOpen(false);
                        await signOut();
                        navigate("/");
                      }}
                    >
                      <LogOut size={16} />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function roleLabel(role: string | null | undefined) {
  if (role === "student") return "Student";
  if (role === "adminSolver") return "Admin solver";
  if (role === "solver") return "Solver";
  if (role === "staff") return "Admin";
  return "Guest";
}

/** Thumb-reachable navigation for phones and tablets (hidden from 900px). */
export function BottomNav({ unread = 0 }: { unread?: number }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  let current = location.pathname;
  if (current.startsWith("/questions")) current = "/questions";

  const items: Array<[string, typeof Home, string]> = [
    ["/", Home, "Home"],
    ["/questions", MessagesSquare, "Questions"],
  ];
  if (!user) items.push(["/login", LogIn, "Log in"]);
  if (user?.role === "student")
    items.push(
      ["/ask", PlusCircle, "Ask"],
      ["/notifications", Bell, "Alerts"],
      ["/me", User, "Profile"],
    );
  if (isSolver(user?.role))
    items.push(["/solver", LayoutDashboard, "Dashboard"], ["/notifications", Bell, "Alerts"]);

  return (
    <nav className="bnav" aria-label="Main navigation">
      {items.map(([to, Icon, label]) => {
        const badge = to === "/notifications" && unread > 0;
        return (
          <button
            key={`${to}-${label}`}
            type="button"
            aria-current={current === to ? "page" : undefined}
            onClick={() => navigate(to)}
          >
            <span className="bn-ic">
              <Icon size={22} aria-hidden="true" />
              {badge && (
                <span className="badge" aria-hidden="true">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            <span className="bn-l">
              {label}
              {badge && <span className="sr">, {unread} unread</span>}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Brand />
            <p className="tagline">
              Ask. Solve. Learn.<span>No doubt left unsolved</span>
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <ul>
              <li>
                <Link to="/questions">
                  <button type="button">Questions</button>
                </Link>
              </li>
              <li>
                <Link to="/#how">
                  <button type="button">How a question moves</button>
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4>Account</h4>
            <ul>
              <li>
                <Link to="/login">
                  <button type="button">Student login</button>
                </Link>
              </li>
              <li>
                <Link to="/login/solver">
                  <button type="button">Solver login</button>
                </Link>
              </li>
              <li>
                <Link to="/ask">
                  <button type="button">Ask a question</button>
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} Achieve Doubts</span>
          <span>
            All solvers are verified before they can lock and answer questions.
          </span>
        </div>
      </div>
    </footer>
  );
}

export type { SessionUser };
