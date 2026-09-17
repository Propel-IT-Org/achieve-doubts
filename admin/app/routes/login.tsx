import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { z } from "zod";

import type { Route } from "./+types/login";
import { Brand } from "~/components/primitives";
import { isStaff, signInEmail, signOut, useSession } from "~/lib/session";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Admin sign in — Achieve Doubts" }];
}

const EMPTY = "Enter your email and password.";
const NOT_ADMIN = "That email and password don't match an admin account.";

const loginSchema = z.object({
  email: z.string().trim().min(1, EMPTY),
  password: z.string().min(1, EMPTY),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, isPending } = useSession();
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (!isPending && isStaff(user)) return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setError("");
    const { data, error: authError } = await signInEmail(email, password);
    const role = (data?.user as { role?: string } | undefined)?.role;
    if (authError || role !== "staff") {
      // A student or solver account is valid on the main site, not here.
      // Sign it straight back out, and don't say which part was wrong.
      if (!authError) await signOut();
      setError(NOT_ADMIN);
      return;
    }
    navigate("/", { replace: true });
  });

  const message = errors.email?.message ?? errors.password?.message ?? error;

  return (
    <main id="main" className="adm-login">
      <div className="adm-login-in">
        <div className="adm-login-top">
          <Brand />
        </div>
        <form className="panel" onSubmit={onSubmit} noValidate>
          <div>
            <span className="auth-kind">
              <ShieldCheck size={16} aria-hidden="true" />
              Admin panel
            </span>
            <h1 className="h2" style={{ margin: "6px 0 6px" }}>
              Admin sign in
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              For Achieve Doubts staff. Admin accounts are separate from student
              and solver accounts.
            </p>
          </div>
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              aria-invalid={errors.email ? "true" : undefined}
              {...register("email", { onChange: () => setError("") })}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              aria-invalid={errors.password ? "true" : undefined}
              {...register("password", { onChange: () => setError("") })}
            />
          </label>
          {message && (
            <div className="err" role="alert">
              <AlertTriangle size={16} />
              {message}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting}>
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
