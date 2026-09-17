import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  // Everything else is staff-only and shares the admin frame.
  layout("routes/_panel.tsx", [
    index("routes/reports.tsx"),
    route("students", "routes/students.tsx"),
    route("solvers", "routes/solvers.tsx"),
    route("solvers/new", "routes/solvers.new.tsx"),
    route("analytics", "routes/analytics.tsx"),
    route("invoice", "routes/invoice.tsx"),
  ]),
] satisfies RouteConfig;
