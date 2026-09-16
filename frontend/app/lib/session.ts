import { authClient } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  image?: string | null;
};

/**
 * Thin wrapper over better-auth's React client so components import one
 * shape rather than reaching into the client's inferred types directly.
 */
export function useSession(): {
  user: SessionUser | null;
  isPending: boolean;
} {
  const { data, isPending } = authClient.useSession();
  const user = (data?.user ?? null) as SessionUser | null;
  return { user, isPending };
}

export async function signOut() {
  await authClient.signOut();
}

export async function signInUsername(username: string, password: string) {
  return authClient.signIn.username({ username, password });
}

/** Resolves the current session once, outside React (for clientLoader). */
export async function getSession(): Promise<SessionUser | null> {
  const { data } = await authClient.getSession();
  return (data?.user ?? null) as SessionUser | null;
}

export const SOLVER_ROLES = ["solver", "adminSolver", "staff"] as const;

export function isSolver(role: string | null | undefined): boolean {
  return Boolean(role && (SOLVER_ROLES as readonly string[]).includes(role));
}

export function isAdminSolver(role: string | null | undefined): boolean {
  return role === "adminSolver" || role === "staff";
}
