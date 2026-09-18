import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertTriangle, UserCheck } from "lucide-react";
import { z } from "zod";

import type { Route } from "./+types/login.solver";
import { signInEmail } from "~/lib/session";
import { toast } from "sonner";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Solver login — Achieve Doubts" }];
}

const EMPTY = "Enter your email and password.";

const loginSchema = z.object({
  email: z.string().trim().min(1, EMPTY),
  password: z.string().min(1, EMPTY),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function SolverLogin() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError("");
    const { error: authError } = await signInEmail(values.email, values.password);
    if (authError) {
      setError(authError.message ?? "That email and password don't match.");
      return;
    }
    toast("Signed in");
    navigate("/solver");
  });

  const message = errors.email?.message ?? errors.password?.message ?? error;

  return (
    <main id="main" className="page">
      <div className="wrap">
        <div className="auth">
          <div className="ph" style={{ marginBottom: 20 }}>
            <span className="auth-kind">
              <UserCheck size={16} aria-hidden="true" />
              Solver
            </span>
            <h1>Solver login</h1>
            <p>For verified solvers. Solver accounts are created by an admin.</p>
          </div>

          <form className="panel" onSubmit={onSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                autoComplete="username"
                aria-invalid={errors.email ? "true" : undefined}
                {...register("email")}
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                aria-invalid={errors.password ? "true" : undefined}
                {...register("password")}
              />
            </label>

            {message && (
              <div className="err" role="alert">
                <AlertTriangle size={16} />
                {message}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isSubmitting}
            >
              Log in
            </button>

            <Link className="btn btn-text" style={{ justifySelf: "start" }} to="/login">
              Student? Use student login
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}
