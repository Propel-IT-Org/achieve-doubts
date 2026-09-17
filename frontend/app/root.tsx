import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import { AlertTriangle } from "lucide-react";

import type { Route } from "./+types/root";
import "./app.css";
import { BottomNav, Footer, Header } from "./components/shell";
import { Gate, SvgDefs } from "./components/primitives";
import { Toaster } from "./components/toast";
import { useSession } from "./lib/session";
import { useUnreadCount } from "./lib/queries";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { user } = useSession();
  const unread = useUnreadCount(Boolean(user));
  const location = useLocation();

  // The admin panel is its own shell (dark sidebar, no public header/footer),
  // mirroring the prototype's separate admin.acsdoubts.com surface.
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) {
    return (
      <div className="acs no-bnav" lang="en">
        <SvgDefs />
        <Outlet />
        <Toaster />
      </div>
    );
  }

  return (
    <div className="acs has-bnav" lang="en">
      <SvgDefs />
      <Header unread={unread} />
      <Outlet />
      <Footer />
      <BottomNav unread={unread} />
      <Toaster />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Page not found" : "Error";
    details =
      error.status === 404
        ? "The page you were looking for doesn't exist."
        : error.statusText || details;
  } else if (error instanceof Error) {
    details = error.message;
    if (import.meta.env.DEV) stack = error.stack;
  }

  return (
    <div className="acs no-bnav" lang="en">
      <SvgDefs />
      <main id="main" className="page">
        <div className="wrap">
          <Gate icon={<AlertTriangle size={24} />} title={title} text={details}>
            <a className="btn btn-primary" href="/">
              Go to the homepage
            </a>
          </Gate>
          {stack && (
            <pre
              className="panel"
              style={{ overflowX: "auto", fontSize: 12, marginTop: 24 }}
            >
              <code>{stack}</code>
            </pre>
          )}
        </div>
      </main>
    </div>
  );
}
