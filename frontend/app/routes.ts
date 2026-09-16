import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("questions", "routes/questions.tsx"),
  route("questions/:id", "routes/questions.$id.tsx"),
  route("ask", "routes/ask.tsx"),
  route("login", "routes/login.tsx"),
  route("login/solver", "routes/login.solver.tsx"),
  route("solver", "routes/solver.tsx"),
  route("notifications", "routes/notifications.tsx"),
  route("me", "routes/me.tsx"),
  route("students/:id", "routes/students.$id.tsx"),
  route("solvers/:id", "routes/solvers.$id.tsx"),
] satisfies RouteConfig;
