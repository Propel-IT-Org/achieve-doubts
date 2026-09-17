import { authClient } from "./auth";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string | null;
};

export function useSession(): { user: SessionUser | null; isPending: boolean } {
  const { data, isPending } = authClient.useSession();
  return { user: (data?.user ?? null) as SessionUser | null, isPending };
}

/** Resolves the current session once, outside React (for clientLoader). */
export async function getSession(): Promise<SessionUser | null> {
  const { data } = await authClient.getSession();
  return (data?.user ?? null) as SessionUser | null;
}

/** Staff sign in with email and password, as in the prototype. */
export function signInEmail(email: string, password: string) {
  return authClient.signIn.email({ email, password });
}

export async function signOut() {
  await authClient.signOut();
}

/** Only staff hold the admin-panel permissions (backend permissions.ts). */
export function isStaff(user: SessionUser | null): boolean {
  return user?.role === "staff";
}
