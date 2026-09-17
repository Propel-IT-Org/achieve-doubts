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
import { Gate, SvgDefs } from "./components/primitives";
import { Toaster } from "./components/toast";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
];

export function meta() {
  return [
    { title: "Admin panel — Achieve Doubts" },
    // Staff-only: nothing here belongs in a search index.
    { name: "robots", content: "noindex" },
  ];
}

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
  // The panel has the dark bottom nav on phones; the sign-in page doesn't.
  const signingIn = useLocation().pathname === "/login";

  return (
    <div className={`acs ${signingIn ? "no-bnav" : "has-bnav"}`} lang="en">
      <SvgDefs />
      <Outlet />
      <Toaster />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let details = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Page not found" : "Error";
    details =
      error.status === 404
        ? "The page you were looking for doesn't exist."
        : error.statusText || details;
  } else if (error instanceof Error) {
    details = error.message;
  }

  return (
    <div className="acs no-bnav" lang="en">
      <SvgDefs />
      <main id="main" className="page">
        <div className="wrap">
          <Gate icon={<AlertTriangle size={24} />} title={title} text={details}>
            <a className="btn btn-primary" href="/">
              Go to the admin panel
            </a>
          </Gate>
        </div>
      </main>
    </div>
  );
}
