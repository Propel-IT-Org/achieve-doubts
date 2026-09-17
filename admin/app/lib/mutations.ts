import { mutate } from "swr";
import useSWRMutation from "swr/mutation";
import { api, unwrap } from "./api";

/**
 * Every write goes through `useSWRMutation`, then revalidates what it
 * changed — the server decides the resulting state.
 */

function revalidate(...prefixes: string[]) {
  return mutate(
    (key) => Array.isArray(key) && prefixes.includes(key[0] as string),
    undefined,
    { revalidate: true },
  );
}

export function useResolveReport() {
  return useSWRMutation(
    ["reports", "resolve"],
    async (_key, { arg }: { arg: { id: number } }) => {
      const res = await api.api.admin.reports[":id"].resolve.$post({
        param: { id: String(arg.id) },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("reports");
      return out;
    },
  );
}

/** Deactivation bans the account, which also signs it out everywhere. */
export function useSetStudentActive() {
  return useSWRMutation(
    ["students", "active"],
    async (_key, { arg }: { arg: { id: string; active: boolean } }) => {
      const res = await api.api.admin.students[":id"].active.$post({
        param: { id: arg.id },
        json: { active: arg.active },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("students", "student");
      return out;
    },
  );
}

export function useSetSolverActive() {
  return useSWRMutation(
    ["solvers", "active"],
    async (_key, { arg }: { arg: { id: string; active: boolean } }) => {
      const res = await api.api.admin.solvers[":id"].active.$post({
        param: { id: arg.id },
        json: { active: arg.active },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("solvers");
      return out;
    },
  );
}

export function useSetSolverAdmin() {
  return useSWRMutation(
    ["solvers", "admin"],
    async (_key, { arg }: { arg: { id: string; isAdminSolver: boolean } }) => {
      const res = await api.api.admin.solvers[":id"].admin.$post({
        param: { id: arg.id },
        json: { isAdminSolver: arg.isAdminSolver },
      });
      const out = await unwrap<unknown>(res);
      await revalidate("solvers");
      return out;
    },
  );
}

export type CreateSolverBody = {
  name: string;
  email: string;
  username: string;
  phone: string;
  institution: string;
  password: string;
};

export function useCreateSolver() {
  return useSWRMutation(
    ["solvers", "create"],
    async (_key, { arg }: { arg: CreateSolverBody }) => {
      const res = await api.api.admin.solvers.$post({ json: arg });
      const out = await unwrap<{ id: string }>(res);
      await revalidate("solvers");
      return out;
    },
  );
}
